import { readFileSync } from "node:fs";
import type { Driver } from "../src/core/persistence/Driver.ts";
import type { AuthState } from "../src/modules/auth/AuthState.ts";
import type { AuthStateService } from "../src/modules/auth/AuthStateService.ts";
import {
    IMMUTABLE_STOCK_MOVEMENT_SEMANTICS_VERSION,
    type StockMovement
} from "../src/modules/inventory/StockMovement.ts";
import { stockMovementStorageKeyForAccount } from "../src/modules/inventory/persistence/StockMovementPersistenceKey.ts";
import { StockMovementRepository } from "../src/modules/inventory/repositories/StockMovementRepository.ts";
import { StockMovementSyncRepository } from "../src/modules/inventory/repositories/StockMovementSyncRepository.ts";
import { InventoryService } from "../src/modules/inventory/services/InventoryService.ts";
import { StockMovementLocalMutationApplier } from "../src/modules/inventory/sync/StockMovementLocalMutationApplier.ts";
import { StockMovementSyncAdapter } from "../src/modules/inventory/sync/StockMovementSyncAdapter.ts";
import { buildStockMovementAppendOperation } from "../src/modules/inventory/sync/StockMovementSyncOperation.ts";
import { StockMovementSyncOperationTransport } from "../src/modules/inventory/sync/StockMovementSyncOperationTransport.ts";
import {
    createStockMovementCloudEnvelope,
    stockMovementRecordPath
} from "../src/modules/inventory/sync/StockMovementSyncTypes.ts";
import { StockMovementValidator } from "../src/modules/inventory/validators/StockMovementValidator.ts";
import type { Product } from "../src/modules/products/Product.ts";
import { ProductFactory } from "../src/modules/products/factories/ProductFactory.ts";
import { ProductRepository } from "../src/modules/products/repositories/ProductRepository.ts";
import { ProductSyncRepository } from "../src/modules/products/repositories/ProductSyncRepository.ts";
import { CreateProductWithOpeningStockService } from "../src/modules/products/services/CreateProductWithOpeningStockService.ts";
import { ProductService } from "../src/modules/products/services/ProductService.ts";
import { productSyncCodec } from "../src/modules/products/sync/ProductSyncCodec.ts";
import { ProductValidator } from "../src/modules/products/validators/ProductValidator.ts";
import type {
    SyncAuthStateSource,
    SyncExecutionResult,
    SyncOperationTransport
} from "../src/modules/sync/SyncContracts.ts";
import {
    createPendingSyncOperation,
    type SyncOperation
} from "../src/modules/sync/SyncOperation.ts";
import { inspectSyncOperationGroup } from "../src/modules/sync/SyncOperationGroup.ts";
import { MasterDataLocalMutationApplier } from "../src/modules/sync/master-data/MasterDataLocalMutationApplier.ts";
import { MasterDataSyncOperationTransport } from "../src/modules/sync/master-data/MasterDataSyncOperationTransport.ts";
import { MasterDataSyncRepositoryBridge } from "../src/modules/sync/master-data/MasterDataSyncRepositoryBridge.ts";
import { syncOutboxKeyForAccount } from "../src/modules/sync/persistence/SyncPersistenceKeys.ts";
import { MasterDataSyncStateRepository } from "../src/modules/sync/repositories/MasterDataSyncStateRepository.ts";
import { PersistentOutboxRepository } from "../src/modules/sync/repositories/PersistentOutboxRepository.ts";
import { SyncConflictRepository } from "../src/modules/sync/repositories/SyncConflictRepository.ts";
import { SyncReceiptRepository } from "../src/modules/sync/repositories/SyncReceiptRepository.ts";
import { DurableMutationCapture } from "../src/modules/sync/services/DurableMutationCapture.ts";
import { DurableMutationGroupCapture } from "../src/modules/sync/services/DurableMutationGroupCapture.ts";
import { ListenerCoordinator } from "../src/modules/sync/services/ListenerCoordinator.ts";
import { LocalMutationApplierRegistry } from "../src/modules/sync/services/LocalMutationApplierRegistry.ts";
import { LocalMutationReconciler } from "../src/modules/sync/services/LocalMutationReconciler.ts";
import { RetryPolicy } from "../src/modules/sync/services/RetryPolicy.ts";
import { SyncCloudCapabilityRegistry } from "../src/modules/sync/services/SyncCloudCapabilityRegistry.ts";
import { SyncCoordinator } from "../src/modules/sync/services/SyncCoordinator.ts";
import { SyncModeService } from "../src/modules/sync/services/SyncModeService.ts";
import { SyncOperationTransportRegistry } from "../src/modules/sync/services/SyncOperationTransportRegistry.ts";
import { SyncStatusService } from "../src/modules/sync/services/SyncStatusService.ts";

const accountId = "logical-account-a";
const foreignAccountId = "logical-account-b";
const userId = "logical-user-a";
const firebaseUid = "firebase-auth-member-a";
const timestamp = "2026-07-15T16:00:00.000Z";

class MemoryDriver implements Driver {
    private readonly values = new Map<string, unknown>();
    private failNextKey: string | null = null;
    public readonly writes: Array<{ key: string; value: unknown }> = [];

    public read<T>(key: string): T | null {
        return this.values.has(key)
            ? structuredClone(this.values.get(key)) as T
            : null;
    }

    public write<T>(key: string, value: T): void {
        if (this.failNextKey === key) {
            this.failNextKey = null;
            throw new Error("Injected persistence failure.");
        }

        const cloned = structuredClone(value);
        this.values.set(key, cloned);
        this.writes.push({ key, value: structuredClone(cloned) });
    }

    public remove(key: string): void {
        this.values.delete(key);
    }

    public clear(): void {
        this.values.clear();
    }

    public failNextWriteFor(key: string): void {
        this.failNextKey = key;
    }
}

class FakeNetworkError extends Error {
    public readonly code = "network_unavailable";
}

class FakeRealtimeStore {
    private readonly values = new Map<string, unknown>();
    private failNextFragment: string | null = null;
    public readonly successfulWrites: string[][] = [];
    public readonly subscriptions: string[] = [];

    public async read<T>(path: string): Promise<T | null> {
        return this.values.has(path)
            ? structuredClone(this.values.get(path)) as T
            : null;
    }

    public async updateChildren(
        path: string,
        values: Record<string, unknown>
    ): Promise<void> {
        const childPaths = Object.keys(values).map(child => `${path}/${child}`);

        if (
            this.failNextFragment
            && childPaths.some(child => child.includes(this.failNextFragment as string))
        ) {
            this.failNextFragment = null;
            throw new FakeNetworkError("Injected transient RTDB failure.");
        }

        for (const [child, value] of Object.entries(values)) {
            this.values.set(`${path}/${child}`, structuredClone(value));
        }

        this.successfulWrites.push(childPaths);
    }

    public serverTimestampValue(): object {
        return 1_721_000_000_000 as unknown as object;
    }

    public subscribe<T>(
        path: string,
        _callback: (value: T | null) => void,
        _onError?: (error: Error) => void
    ): () => void {
        this.subscriptions.push(path);
        return () => undefined;
    }

    public put(path: string, value: unknown): void {
        this.values.set(path, structuredClone(value));
    }

    public failNextWriteContaining(fragment: string): void {
        this.failNextFragment = fragment;
    }

    public writeCountContaining(fragment: string): number {
        return this.successfulWrites.filter(paths =>
            paths.some(path => path.includes(fragment))
        ).length;
    }
}

class FakeAuthStateSource implements SyncAuthStateSource {
    public getState(): AuthState {
        return authenticatedState();
    }

    public subscribe(_subscriber: (state: AuthState) => void): () => void {
        return () => undefined;
    }
}

interface InventoryHarness {
    driver: MemoryDriver;
    mode: SyncModeService;
    capabilities: SyncCloudCapabilityRegistry;
    outbox: PersistentOutboxRepository;
    receipts: SyncReceiptRepository;
    conflicts: SyncConflictRepository;
    raw: StockMovementRepository;
    synced: StockMovementSyncRepository;
    applier: StockMovementLocalMutationApplier;
    inventory: InventoryService;
    adapter: StockMovementSyncAdapter;
    store: FakeRealtimeStore;
    transport: StockMovementSyncOperationTransport;
    authSource: FakeAuthStateSource;
}

function createInventoryHarness(
    mode: "disabled" | "active" = "active",
    stockCapability = true,
    driver = new MemoryDriver()
): InventoryHarness {
    const syncMode = new SyncModeService();
    const capabilities = new SyncCloudCapabilityRegistry();

    if (stockCapability) {
        capabilities.register("stockMovements", ["append"]);
    }

    const outbox = new PersistentOutboxRepository(
        driver,
        operation => capabilities.supports(operation)
    );
    const capture = new DurableMutationCapture(outbox, () => timestamp);
    const raw = new StockMovementRepository(driver);
    const validator = new StockMovementValidator();
    const applier = new StockMovementLocalMutationApplier(raw, validator);
    const synced = new StockMovementSyncRepository(
        raw,
        syncMode,
        capture,
        applier,
        outbox,
        () => timestamp
    );
    const auth = new FakeAuthStateSource();
    const products = new ProductService(
        new ProductRepository(driver),
        new ProductValidator(),
        auth as unknown as AuthStateService
    );
    const inventory = new InventoryService(
        synced,
        validator,
        auth as unknown as AuthStateService,
        products
    );
    const conflicts = new SyncConflictRepository(driver);
    const receipts = new SyncReceiptRepository(driver);
    const listeners = new ListenerCoordinator();
    const store = new FakeRealtimeStore();
    const adapter = new StockMovementSyncAdapter(
        store,
        syncMode,
        auth,
        outbox,
        conflicts,
        listeners,
        applier
    );
    const transport = new StockMovementSyncOperationTransport(
        store,
        () => "abonibal-erp-test"
    );

    if (mode === "active") {
        activate(syncMode);
    }

    return {
        driver,
        mode: syncMode,
        capabilities,
        outbox,
        receipts,
        conflicts,
        raw,
        synced,
        applier,
        inventory,
        adapter,
        store,
        transport,
        authSource: auth
    };
}

interface GroupHarness {
    driver: MemoryDriver;
    mode: SyncModeService;
    capabilities: SyncCloudCapabilityRegistry;
    outbox: PersistentOutboxRepository;
    receipts: SyncReceiptRepository;
    conflicts: SyncConflictRepository;
    store: FakeRealtimeStore;
    service: CreateProductWithOpeningStockService;
    inventory: InventoryService;
    coordinator: SyncCoordinator;
    transportRegistry: SyncOperationTransportRegistry;
    rawMovements: StockMovementRepository;
}

function createGroupHarness(): GroupHarness {
    const driver = new MemoryDriver();
    const mode = new SyncModeService();
    activate(mode);
    const capabilities = new SyncCloudCapabilityRegistry();
    capabilities.register("products", ["create", "update"]);
    const outbox = new PersistentOutboxRepository(
        driver,
        operation => capabilities.supports(operation)
    );
    const receipts = new SyncReceiptRepository(driver);
    const conflicts = new SyncConflictRepository(driver);
    const syncState = new MasterDataSyncStateRepository(driver);
    const capture = new DurableMutationCapture(outbox, () => timestamp);
    const registry = new LocalMutationApplierRegistry();
    const authSource = new FakeAuthStateSource();
    const auth = authSource as unknown as AuthStateService;
    const productCache = new ProductRepository(driver);
    const productApplier = new MasterDataLocalMutationApplier(
        productCache,
        syncState,
        productSyncCodec,
        () => timestamp
    );
    registry.register(productApplier);
    const productBridge = new MasterDataSyncRepositoryBridge(
        productCache,
        mode,
        capture,
        productApplier,
        syncState,
        productSyncCodec,
        () => timestamp
    );
    const productValidator = new ProductValidator();
    const products = new ProductService(
        new ProductSyncRepository(productCache, productBridge),
        productValidator,
        auth
    );
    const rawMovements = new StockMovementRepository(driver);
    const movementValidator = new StockMovementValidator();
    const movementApplier = new StockMovementLocalMutationApplier(
        rawMovements,
        movementValidator
    );
    registry.register(movementApplier);
    const groupCapture = new DurableMutationGroupCapture(
        outbox,
        registry,
        capture
    );
    const inventory = new InventoryService(
        rawMovements,
        movementValidator,
        auth,
        products
    );
    const service = new CreateProductWithOpeningStockService(
        new ProductFactory(),
        products,
        productValidator,
        productCache,
        productBridge,
        rawMovements,
        movementValidator,
        groupCapture,
        mode,
        auth
    );
    const store = new FakeRealtimeStore();
    const transportRegistry = new SyncOperationTransportRegistry();
    transportRegistry.register(
        ["products", "customers", "suppliers"],
        new MasterDataSyncOperationTransport(
            store,
            () => "abonibal-erp-test"
        )
    );
    transportRegistry.register(
        ["stockMovements"],
        new StockMovementSyncOperationTransport(
            store,
            () => "abonibal-erp-test"
        )
    );
    const coordinator = createCoordinator({
        mode,
        outbox,
        receipts,
        conflicts,
        transport: transportRegistry,
        authSource
    });

    return {
        driver,
        mode,
        capabilities,
        outbox,
        receipts,
        conflicts,
        store,
        service,
        inventory,
        coordinator,
        transportRegistry,
        rawMovements
    };
}

function createCoordinator(input: {
    mode: SyncModeService;
    outbox: PersistentOutboxRepository;
    receipts: SyncReceiptRepository;
    conflicts: SyncConflictRepository;
    transport: SyncOperationTransport;
    authSource: SyncAuthStateSource;
    clock?: () => string;
}): SyncCoordinator {
    const coordinator = new SyncCoordinator(
        input.mode,
        input.outbox,
        input.receipts,
        input.conflicts,
        new RetryPolicy({
            maxAttempts: 5,
            baseDelayMs: 1,
            maxDelayMs: 10,
            jitterRatio: 0
        }),
        new ListenerCoordinator(),
        new SyncStatusService(),
        input.transport,
        input.authSource,
        input.clock ?? (() => timestamp)
    );
    coordinator.start();
    return coordinator;
}

function movement(
    id: string,
    quantityDelta: number,
    type: StockMovement["type"] = "manual_adjustment"
): StockMovement {
    return {
        id,
        accountId,
        productId: "product-stock-a",
        type,
        quantityDelta,
        reason: `Movement ${id}`,
        referenceType: "manual",
        referenceId: id,
        createdAt: timestamp,
        createdBy: userId,
        ledgerSemanticsVersion: IMMUTABLE_STOCK_MOVEMENT_SEMANTICS_VERSION
    };
}

function cloudEnvelope(value: StockMovement): ReturnType<
    typeof createStockMovementCloudEnvelope
> {
    const operation = createPendingSyncOperation(
        buildStockMovementAppendOperation(value, timestamp)
    );
    const envelope = createStockMovementCloudEnvelope(operation);
    envelope.meta.serverUpdatedAt = 1_721_000_000_000;
    return envelope;
}

function addProduct(
    repository: ProductRepository,
    quantity = 999
): void {
    const now = new Date(timestamp);
    const product: Product = {
        id: "product-stock-a",
        sku: "SKU-STOCK-A",
        barcode: "BAR-STOCK-A",
        name: "Stock Product",
        description: "",
        images: [],
        category: "",
        brand: "",
        unit: "piece",
        purchasePrice: 1,
        salePrice: 2,
        taxRate: 0,
        quantity,
        minimumQuantity: 0,
        isActive: true,
        accountId,
        createdBy: userId,
        updatedBy: userId,
        createdAt: now,
        updatedAt: now
    };
    repository.addToAccount(accountId, product);
}

function groupCommand(productId: string, openingQuantity = 10) {
    return {
        productId,
        createdAt: timestamp,
        data: {
            name: `Product ${productId}`,
            englishName: `Product ${productId}`,
            sku: `SKU-${productId}`,
            barcode: `BAR-${productId}`,
            salePrice: 25,
            openingQuantity
        }
    };
}

function authenticatedState(): AuthState {
    return {
        status: "authenticated",
        session: {
            account: { id: accountId, name: "Logical Account" },
            user: {
                id: userId,
                accountId,
                provider: "firebase",
                providerUserId: firebaseUid,
                email: "qa@example.invalid",
                displayName: "QA User",
                role: "owner"
            },
            authenticatedAt: timestamp
        }
    };
}

function activate(mode: SyncModeService): void {
    mode.activate({
        ownerApproved: true,
        migrationVerified: true,
        cutoverApproved: true,
        approvalReference: "SYNC-006-HARNESS-ONLY"
    });
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

async function assertRejects(
    action: () => Promise<unknown>,
    message: string
): Promise<void> {
    let rejected = false;
    try {
        await action();
    } catch {
        rejected = true;
    }
    assert(rejected, message);
}

function assertThrows(action: () => unknown, message: string): void {
    let threw = false;
    try {
        action();
    } catch {
        threw = true;
    }
    assert(threw, message);
}

type Test = { name: string; run: () => void | Promise<void> };

const tests: Test[] = [
    {
        name: "default SyncMode is disabled",
        run: () => assert(new SyncModeService().getMode() === "disabled", "Default mode changed.")
    },
    {
        name: "disabled append is local-only with no outbox",
        run: () => {
            const h = createInventoryHarness("disabled");
            h.synced.appendForAccount(accountId, movement("disabled-local", 4));
            assert(h.raw.allForAccount(accountId).length === 1, "Disabled append did not persist locally.");
            assert(h.outbox.allForAccount(accountId).length === 0, "Disabled append created outbox work.");
        }
    },
    {
        name: "active append captures exactly one durable operation",
        run: () => {
            const h = createInventoryHarness();
            h.synced.appendForAccount(accountId, movement("active-one", 5));
            assert(h.raw.allForAccount(accountId).length === 1, "Active append missing locally.");
            assert(h.outbox.allForAccount(accountId).length === 1, "Active append operation count is not one.");
        }
    },
    {
        name: "active append rejects a cross-account movement before capture",
        run: () => {
            const h = createInventoryHarness();
            assertThrows(
                () => h.synced.appendForAccount(foreignAccountId, movement("cross-account", 1)),
                "Cross-account movement was accepted."
            );
            assert(h.raw.allForAccount(accountId).length === 0, "Cross-account rejection changed local inventory.");
            assert(h.outbox.allForAccount(accountId).length === 0, "Cross-account rejection created outbox work.");
        }
    },
    {
        name: "sale deduction append is captured exactly once",
        run: () => {
            const h = createInventoryHarness();
            const deduction: StockMovement = {
                ...movement("invoice-deduction", -3, "sale_deduction"),
                referenceType: "invoice",
                referenceId: "invoice-sync-a"
            };
            h.synced.appendForAccount(accountId, deduction);
            h.synced.appendForAccount(accountId, deduction);
            assert(h.raw.allForAccount(accountId).length === 1, "Invoice deduction was duplicated locally.");
            assert(h.outbox.allForAccount(accountId).length === 1, "Invoice deduction was not captured exactly once.");
        }
    },
    {
        name: "sale return append is captured exactly once",
        run: () => {
            const h = createInventoryHarness();
            const saleReturn: StockMovement = {
                ...movement("invoice-return", 2, "sale_return"),
                referenceType: "invoice_return",
                referenceId: "invoice-return-sync-a"
            };
            h.synced.appendForAccount(accountId, saleReturn);
            h.synced.appendForAccount(accountId, saleReturn);
            assert(h.raw.allForAccount(accountId).length === 1, "Invoice return was duplicated locally.");
            assert(h.outbox.allForAccount(accountId).length === 1, "Invoice return was not captured exactly once.");
        }
    },
    {
        name: "outbox failure prevents local movement",
        run: () => {
            const h = createInventoryHarness();
            h.driver.failNextWriteFor(syncOutboxKeyForAccount(accountId));
            assertThrows(
                () => h.synced.appendForAccount(accountId, movement("outbox-fail", 2)),
                "Outbox failure was not surfaced."
            );
            assert(h.raw.allForAccount(accountId).length === 0, "Movement ran before durable persistence.");
        }
    },
    {
        name: "local apply failure retains operation and blocks cloud",
        run: () => {
            const h = createInventoryHarness();
            h.driver.failNextWriteFor(stockMovementStorageKeyForAccount(accountId));
            assertThrows(
                () => h.synced.appendForAccount(accountId, movement("cache-fail", 2)),
                "Cache failure was not surfaced."
            );
            const retained = h.outbox.allForAccount(accountId);
            assert(retained.length === 1 && retained[0].localApplyState === "failed", "Failed operation was not retained.");
            assert(h.outbox.getPending(accountId, timestamp).length === 0, "Failed local apply became cloud eligible.");
        }
    },
    {
        name: "crash after outbox before cache recovers once",
        run: () => {
            const h = createInventoryHarness();
            const input = buildStockMovementAppendOperation(movement("recover-before-cache", 3), timestamp);
            h.outbox.enqueue(accountId, input);
            const capture = new DurableMutationCapture(h.outbox, () => timestamp);
            const result = capture.applyPersistedOperation(
                h.outbox.findByOperationId(accountId, input.operationId)!,
                h.applier
            );
            assert(result.success, "Persisted operation did not recover.");
            assert(h.raw.allForAccount(accountId).length === 1, "Recovery did not append exactly once.");
        }
    },
    {
        name: "crash after cache before applied marker does not duplicate",
        run: () => {
            const h = createInventoryHarness();
            const value = movement("recover-after-cache", 3);
            const input = buildStockMovementAppendOperation(value, timestamp);
            h.outbox.enqueue(accountId, input);
            h.raw.appendForAccount(accountId, value);
            const capture = new DurableMutationCapture(h.outbox, () => timestamp);
            const result = capture.applyPersistedOperation(
                h.outbox.findByOperationId(accountId, input.operationId)!,
                h.applier
            );
            assert(result.success && result.outcome === "already_applied", "Post-cache recovery was not idempotent.");
            assert(h.raw.allForAccount(accountId).length === 1, "Post-cache recovery duplicated movement.");
        }
    },
    {
        name: "exact append retry keeps one outbox operation and movement",
        run: () => {
            const h = createInventoryHarness();
            const value = movement("exact-retry", 8);
            h.synced.appendForAccount(accountId, value);
            h.synced.appendForAccount(accountId, value);
            assert(h.outbox.allForAccount(accountId).length === 1, "Exact retry duplicated outbox work.");
            assert(h.raw.allForAccount(accountId).length === 1, "Exact retry duplicated movement.");
        }
    },
    {
        name: "coordinator acknowledges append after receipt persistence",
        run: async () => {
            const h = createInventoryHarness();
            h.synced.appendForAccount(accountId, movement("cloud-ack", 6));
            const coordinator = createCoordinator({
                mode: h.mode,
                outbox: h.outbox,
                receipts: h.receipts,
                conflicts: h.conflicts,
                transport: h.transport,
                authSource: h.authSource
            });
            await coordinator.processNext();
            assert(h.outbox.allForAccount(accountId).length === 0, "Acknowledged outbox entry was not cleaned up.");
            assert(Boolean(h.receipts.allForAccount(accountId)[0]), "Receipt was not persisted.");
            coordinator.dispose();
        }
    },
    {
        name: "identical cloud movement is idempotent MATCH",
        run: async () => {
            const h = createInventoryHarness();
            const value = movement("cloud-match", 7);
            const operation = createPendingSyncOperation(buildStockMovementAppendOperation(value, timestamp));
            h.store.put(stockMovementRecordPath(accountId, value.id), cloudEnvelope(value));
            const result = await h.transport.execute(operation);
            assert(result.kind === "acknowledged" && result.result === "duplicate_acknowledged", "Identical cloud record did not MATCH.");
        }
    },
    {
        name: "same cloud movement ID with divergent payload conflicts",
        run: async () => {
            const h = createInventoryHarness();
            const intended = movement("cloud-conflict", 7);
            h.store.put(
                stockMovementRecordPath(accountId, intended.id),
                cloudEnvelope(movement("cloud-conflict", 8))
            );
            const result = await h.transport.execute(
                createPendingSyncOperation(buildStockMovementAppendOperation(intended, timestamp))
            );
            assert(result.kind === "conflict", "Divergent immutable cloud payload did not conflict.");
        }
    },
    {
        name: "transport rejects every non-TEST Firebase project",
        run: async () => {
            const value = movement("project-guard", 1);
            const transport = new StockMovementSyncOperationTransport(
                new FakeRealtimeStore(),
                () => "not-the-approved-test-project"
            );
            await assertRejects(
                () => transport.execute(createPendingSyncOperation(buildStockMovementAppendOperation(value, timestamp))),
                "Non-TEST project was accepted."
            );
        }
    },
    {
        name: "cloud pull applies cache only once",
        run: () => {
            const h = createInventoryHarness();
            const value = movement("pull-once", 10);
            const first = h.adapter.applyPulledEnvelope(accountId, value.id, cloudEnvelope(value));
            const second = h.adapter.applyPulledEnvelope(accountId, value.id, cloudEnvelope(value));
            assert(first.outcome === "applied" && second.outcome === "duplicate", "Pull outcomes are incorrect.");
            assert(h.raw.allForAccount(accountId).length === 1, "Duplicate pull duplicated movement.");
            assert(h.inventory.getCurrentQuantity(value.productId) === 10, "Duplicate pull changed derived quantity.");
            assert(h.outbox.allForAccount(accountId).length === 0, "Pull created an outbox operation.");
        }
    },
    {
        name: "cloud pull plus ten minus three remains seven after duplicate and reload",
        run: () => {
            const driver = new MemoryDriver();
            const h = createInventoryHarness("active", true, driver);
            const plus = movement("pull-plus-ten", 10);
            const minus = movement("pull-minus-three", -3);
            h.adapter.applyPulledEnvelope(accountId, plus.id, cloudEnvelope(plus));
            h.adapter.applyPulledEnvelope(accountId, minus.id, cloudEnvelope(minus));
            h.adapter.applyPulledEnvelope(accountId, minus.id, cloudEnvelope(minus));
            assert(h.raw.allForAccount(accountId).length === 2, "Duplicate pull changed ledger count.");
            assert(h.inventory.getCurrentQuantity(plus.productId) === 7, "Pulled ledger did not derive seven.");
            const reload = createInventoryHarness("disabled", true, driver);
            assert(reload.inventory.getCurrentQuantity(plus.productId) === 7, "Cache reload changed pulled quantity.");
        }
    },
    {
        name: "pull enforces explicit logical account boundary",
        run: () => {
            const h = createInventoryHarness();
            assertThrows(
                () => h.adapter.applyPulledEnvelope(foreignAccountId, "foreign", {}),
                "Foreign account pull was accepted."
            );
        }
    },
    {
        name: "pull conflict preserves existing immutable local movement",
        run: () => {
            const h = createInventoryHarness();
            h.raw.appendForAccount(accountId, movement("pull-conflict", 2));
            const result = h.adapter.applyPulledEnvelope(
                accountId,
                "pull-conflict",
                cloudEnvelope(movement("pull-conflict", 9))
            );
            assert(result.outcome === "conflict", "Divergent pull did not conflict.");
            assert(h.raw.findForAccount(accountId, "pull-conflict")?.quantityDelta === 2, "Divergent pull overwrote local movement.");
        }
    },
    {
        name: "cache pull source contains no business command replay",
        run: () => {
            const source = readFileSync("src/modules/inventory/sync/StockMovementSyncAdapter.ts", "utf8");
            for (const forbidden of ["issueInvoice(", "returnInvoice(", "reverseMovement(", "createOpeningStock(", "CreateProductWithOpeningStockService"]) {
                assert(!source.includes(forbidden), `Pull adapter replays ${forbidden}.`);
            }
        }
    },
    {
        name: "reversal is a separate append and original remains unchanged",
        run: () => {
            const h = createInventoryHarness();
            const originalResult = h.inventory.addMovement({
                productId: "product-stock-a",
                type: "manual_adjustment",
                quantityDelta: 10,
                reason: "Original",
                referenceType: "manual"
            });
            assert(originalResult.success && originalResult.movement, "Original movement failed.");
            const before = structuredClone(originalResult.movement);
            const reversal = h.inventory.reverseMovement(originalResult.movement.id, "Correction");
            assert(reversal.success && reversal.movement?.type === "reversal", "Reversal movement failed.");
            assert(h.raw.allForAccount(accountId).length === 2, "Reversal did not append independently.");
            assert(JSON.stringify(h.raw.findForAccount(accountId, before.id)) === JSON.stringify(before), "Original movement was mutated.");
            assert(h.outbox.allForAccount(accountId).length === 2, "Reversal append was not captured separately.");
        }
    },
    {
        name: "reversal synchronizes as a separate immutable cloud create",
        run: async () => {
            const h = createInventoryHarness();
            const original = h.inventory.addMovement({
                productId: "product-stock-a",
                type: "manual_adjustment",
                quantityDelta: 10,
                reason: "Cloud reversal original",
                referenceType: "manual"
            });
            assert(original.success && original.movement, "Cloud reversal original failed.");
            const reversal = h.inventory.reverseMovement(original.movement.id, "Cloud reversal");
            assert(reversal.success && reversal.movement, "Cloud reversal append failed.");
            const coordinator = createCoordinator({
                mode: h.mode,
                outbox: h.outbox,
                receipts: h.receipts,
                conflicts: h.conflicts,
                transport: h.transport,
                authSource: h.authSource
            });
            await coordinator.processNext();
            await coordinator.processNext();
            assert(
                await h.store.read(stockMovementRecordPath(accountId, original.movement.id)) !== null,
                "Original cloud movement is missing."
            );
            assert(
                await h.store.read(stockMovementRecordPath(accountId, reversal.movement.id)) !== null,
                "Reversal cloud movement is missing."
            );
            assert(h.outbox.allForAccount(accountId).length === 0, "Cloud reversal operations were not acknowledged.");
            coordinator.dispose();
        }
    },
    {
        name: "original plus reversal derives zero and duplicate reversal pull stays zero",
        run: () => {
            const source = createInventoryHarness();
            const original = movement("original-net-zero", 10);
            source.raw.appendForAccount(accountId, original);
            const reversalResult = source.inventory.reverseMovement(original.id, "Undo");
            assert(reversalResult.success && reversalResult.movement, "Reversal fixture failed.");
            const target = createInventoryHarness();
            target.adapter.applyPulledEnvelope(accountId, original.id, cloudEnvelope(original));
            target.adapter.applyPulledEnvelope(accountId, reversalResult.movement.id, cloudEnvelope(reversalResult.movement));
            target.adapter.applyPulledEnvelope(accountId, reversalResult.movement.id, cloudEnvelope(reversalResult.movement));
            assert(target.inventory.getCurrentQuantity(original.productId) === 0, "Duplicate reversal pull changed net inventory.");
            assert(target.raw.allForAccount(accountId).length === 2, "Duplicate reversal pull duplicated ledger record.");
        }
    },
    {
        name: "derived inventory +10 -3 equals 7 after cache reload",
        run: () => {
            const driver = new MemoryDriver();
            const h = createInventoryHarness("disabled", true, driver);
            h.raw.appendForAccount(accountId, movement("derive-plus", 10));
            h.raw.appendForAccount(accountId, movement("derive-minus", -3));
            assert(h.inventory.getCurrentQuantity("product-stock-a") === 7, "Initial derived inventory is wrong.");
            const reload = createInventoryHarness("disabled", true, driver);
            assert(reload.inventory.getCurrentQuantity("product-stock-a") === 7, "Reload changed derived inventory.");
        }
    },
    {
        name: "Product.quantity is not authoritative",
        run: () => {
            const h = createInventoryHarness("disabled");
            const products = new ProductRepository(h.driver);
            addProduct(products, 999);
            h.raw.appendForAccount(accountId, movement("ledger-five", 5));
            assert(h.inventory.getCurrentQuantity("product-stock-a") === 5, "Product.quantity affected ledger quantity.");
        }
    },
    {
        name: "existing local movement is not automatically enqueued or uploaded",
        run: () => {
            const driver = new MemoryDriver();
            new StockMovementRepository(driver).appendForAccount(accountId, movement("historical-local", 12));
            const h = createInventoryHarness("active", true, driver);
            assert(h.outbox.allForAccount(accountId).length === 0, "Historical movement was automatically enqueued.");
            assert(h.store.successfulWrites.length === 0, "Historical movement was automatically uploaded.");
        }
    },
    {
        name: "same historical append remains local without backfill",
        run: () => {
            const driver = new MemoryDriver();
            const value = movement("historical-retry", 12);
            new StockMovementRepository(driver).appendForAccount(accountId, value);
            const h = createInventoryHarness("active", true, driver);
            h.synced.appendForAccount(accountId, value);
            assert(h.outbox.allForAccount(accountId).length === 0, "Historical exact retry created backfill work.");
        }
    },
    {
        name: "logical accountId remains distinct from Firebase UID",
        run: () => {
            const h = createInventoryHarness();
            h.synced.appendForAccount(accountId, movement("logical-account", 1));
            const operation = h.outbox.allForAccount(accountId)[0];
            assert(operation.accountId === accountId, "Operation lost logical accountId.");
            assert(operation.accountId !== firebaseUid, "Firebase UID became accountId.");
        }
    },
    {
        name: "group is blocked before StockMovement capability registration",
        run: () => {
            const h = createGroupHarness();
            h.service.execute(groupCommand("group-blocked"));
            assert(h.outbox.getPending(accountId, timestamp).length === 0, "Incomplete capability group became eligible.");
            h.coordinator.dispose();
        }
    },
    {
        name: "StockMovement capability registration unlocks Product sequence one",
        run: () => {
            const h = createGroupHarness();
            h.service.execute(groupCommand("group-unlock"));
            h.capabilities.register("stockMovements", ["append"]);
            const pending = h.outbox.getPending(accountId, timestamp);
            assert(pending.length === 1 && pending[0].module === "products", "Capability transition did not unlock Product first.");
            h.coordinator.dispose();
        }
    },
    {
        name: "movement cannot overtake Product in grouped cloud ordering",
        run: () => {
            const h = createGroupHarness();
            h.service.execute(groupCommand("group-no-overtake"));
            h.capabilities.register("stockMovements", ["append"]);
            const members = h.outbox.getGroupMembers(accountId, "product-create-group-no-overtake");
            assertThrows(
                () => h.outbox.markSyncing(accountId, members[1].operationId, timestamp),
                "Movement overtook Product."
            );
            h.coordinator.dispose();
        }
    },
    {
        name: "group cloud processing sends Product then opening movement once",
        run: async () => {
            const h = createGroupHarness();
            h.service.execute(groupCommand("group-order"));
            h.capabilities.register("stockMovements", ["append"]);
            await h.coordinator.processNext();
            const partial = inspectSyncOperationGroup(
                h.outbox.getGroupMembers(accountId, "product-create-group-order")
            );
            assert(partial.cloudState === "partial", "Product acknowledgement was not retained.");
            await h.coordinator.processNext();
            assert(h.store.writeCountContaining("/products/group-order") === 1, "Product cloud create was duplicated.");
            assert(h.store.writeCountContaining("/stockMovements/opening-group-order") === 1, "Opening movement cloud create count is wrong.");
            assert(h.outbox.allForAccount(accountId).length === 0, "Completed group was not cleaned up.");
            h.coordinator.dispose();
        }
    },
    {
        name: "Product ack plus transient movement failure remains recoverable",
        run: async () => {
            const h = createGroupHarness();
            h.service.execute(groupCommand("group-partial"));
            h.capabilities.register("stockMovements", ["append"]);
            await h.coordinator.processNext();
            h.store.failNextWriteContaining("stockMovements/opening-group-partial");
            await h.coordinator.processNext();
            const members = h.outbox.getGroupMembers(accountId, "product-create-group-partial");
            assert(members[0].status === "acknowledged", "Product acknowledgement was lost.");
            assert(members[1].status === "pending", "Movement was not retained for retry.");
            assert(h.store.writeCountContaining("/products/group-partial") === 1, "Product was recreated after movement failure.");
            h.coordinator.dispose();
        }
    },
    {
        name: "restart after Product ack resumes movement without Product duplicate",
        run: async () => {
            const h = createGroupHarness();
            h.service.execute(groupCommand("group-restart"));
            h.capabilities.register("stockMovements", ["append"]);
            await h.coordinator.processNext();
            h.store.failNextWriteContaining("stockMovements/opening-group-restart");
            await h.coordinator.processNext();
            h.coordinator.dispose();
            const restarted = createCoordinator({
                mode: h.mode,
                outbox: h.outbox,
                receipts: h.receipts,
                conflicts: h.conflicts,
                transport: h.transportRegistry,
                authSource: new FakeAuthStateSource(),
                clock: () => "2026-07-15T16:00:00.100Z"
            });
            await restarted.processNext();
            assert(h.store.writeCountContaining("/products/group-restart") === 1, "Restart duplicated Product.");
            assert(h.store.writeCountContaining("/stockMovements/opening-group-restart") === 1, "Restart did not complete movement once.");
            assert(h.outbox.allForAccount(accountId).length === 0, "Restart did not clean completed group.");
            restarted.dispose();
        }
    },
    {
        name: "Product cloud failure blocks opening movement",
        run: async () => {
            const h = createGroupHarness();
            h.service.execute(groupCommand("group-product-fail"));
            h.capabilities.register("stockMovements", ["append"]);
            h.store.failNextWriteContaining("products/group-product-fail");
            await h.coordinator.processNext();
            assert(h.store.writeCountContaining("stockMovements/opening-group-product-fail") === 0, "Movement was sent after Product failure.");
            h.coordinator.dispose();
        }
    },
    {
        name: "opening group exact retry keeps one Product and movement",
        run: () => {
            const h = createGroupHarness();
            h.service.execute(groupCommand("group-retry"));
            h.service.execute(groupCommand("group-retry"));
            assert(h.rawMovements.allForAccount(accountId).length === 1, "Opening retry duplicated movement.");
            assert(h.outbox.getGroupMembers(accountId, "product-create-group-retry").length === 2, "Opening retry duplicated group members.");
            assert(h.inventory.getCurrentQuantity("group-retry") === 10, "Opening retry changed derived inventory.");
            h.coordinator.dispose();
        }
    },
    {
        name: "zero-opening Product remains an ungrouped single operation",
        run: () => {
            const h = createGroupHarness();
            const result = h.service.execute(groupCommand("zero-opening", 0));
            const operations = h.outbox.allForAccount(accountId);
            assert(result.success && operations.length === 1, "Zero-opening Product operation count changed.");
            assert(!operations[0].group && operations[0].module === "products", "Zero-opening Product was grouped.");
            assert(h.rawMovements.allForAccount(accountId).length === 0, "Zero-opening Product created movement.");
            h.coordinator.dispose();
        }
    },
    {
        name: "unconfigured transport registry rejects unsupported module",
        run: async () => {
            const registry = new SyncOperationTransportRegistry();
            await assertRejects(
                () => registry.execute(createPendingSyncOperation(buildStockMovementAppendOperation(movement("unconfigured", 1), timestamp))),
                "Unconfigured module transport was accepted."
            );
        }
    },
    {
        name: "normal disabled startup creates no listener or operational write",
        run: () => {
            const h = createInventoryHarness("disabled");
            assert(h.store.subscriptions.length === 0, "Disabled startup created listener.");
            assert(h.store.successfulWrites.length === 0, "Disabled startup created RTDB write.");
        }
    },
    {
        name: "legacy void metadata is not rewritten or auto-synchronized",
        run: () => {
            const driver = new MemoryDriver();
            const legacy = {
                ...movement("legacy-void", 4),
                ledgerSemanticsVersion: undefined,
                voidedAt: timestamp,
                voidedBy: userId,
                voidReason: "Legacy"
            };
            new StockMovementRepository(driver).appendForAccount(accountId, legacy);
            const h = createInventoryHarness("active", true, driver);
            assert(h.outbox.allForAccount(accountId).length === 0, "Legacy record was enqueued.");
            assert(h.raw.findForAccount(accountId, legacy.id)?.voidedAt === timestamp, "Legacy record was rewritten.");
        }
    },
    {
        name: "StockMovement integration does not scan other module repositories",
        run: () => {
            const source = readFileSync("src/modules/inventory/repositories/StockMovementSyncRepository.ts", "utf8");
            for (const forbidden of ["InvoiceRepository", "PaymentRepository", "PurchaseRepository", "Ledger", "CashMovementRepository"]) {
                assert(!source.includes(forbidden), `StockMovement bridge crossed into ${forbidden}.`);
            }
        }
    }
];

async function main(): Promise<void> {
    let passed = 0;

    for (const test of tests) {
        await test.run();
        passed += 1;
        console.log(`PASS ${passed}: ${test.name}`);
    }

    console.log(JSON.stringify({
        mission: "V1-SYNC-006",
        result: "PASS",
        checks: `${passed}/${tests.length}`,
        appendOnly: true,
        businessCommandReplays: 0,
        existingStockMovementsUploaded: 0,
        existingUserRecordsUploaded: 0,
        migrationBackfill: 0,
        defaultSyncMode: "disabled",
        productQuantityAuthoritative: false,
        operationalLiveRtdbWrites: 0,
        productionTouched: false
    }));
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
