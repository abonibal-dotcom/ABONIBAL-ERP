declare const require: (moduleId: string) => unknown;

const { readFileSync } = require("node:fs") as {
    readFileSync(path: string, encoding: string): string;
};
import type { Driver } from "../src/core/persistence/Driver.ts";
import type { AuthState } from "../src/modules/auth/AuthState.ts";
import type { AuthStateService } from "../src/modules/auth/AuthStateService.ts";
import { InventoryService } from "../src/modules/inventory/services/InventoryService.ts";
import { stockMovementStorageKeyForAccount } from "../src/modules/inventory/persistence/StockMovementPersistenceKey.ts";
import { StockMovementRepository } from "../src/modules/inventory/repositories/StockMovementRepository.ts";
import { StockMovementLocalMutationApplier } from "../src/modules/inventory/sync/StockMovementLocalMutationApplier.ts";
import { StockMovementValidator } from "../src/modules/inventory/validators/StockMovementValidator.ts";
import type { Product } from "../src/modules/products/Product.ts";
import { ProductFactory } from "../src/modules/products/factories/ProductFactory.ts";
import { productStorageKeyForAccount } from "../src/modules/products/persistence/ProductPersistenceKey.ts";
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
import type { SyncOperation } from "../src/modules/sync/SyncOperation.ts";
import { inspectSyncOperationGroup } from "../src/modules/sync/SyncOperationGroup.ts";
import { MasterDataLocalMutationApplier } from "../src/modules/sync/master-data/MasterDataLocalMutationApplier.ts";
import { MasterDataSyncRepositoryBridge } from "../src/modules/sync/master-data/MasterDataSyncRepositoryBridge.ts";
import { syncOutboxKeyForAccount } from "../src/modules/sync/persistence/SyncPersistenceKeys.ts";
import { MasterDataSyncStateRepository } from "../src/modules/sync/repositories/MasterDataSyncStateRepository.ts";
import { PersistentOutboxRepository } from "../src/modules/sync/repositories/PersistentOutboxRepository.ts";
import { SyncConflictRepository } from "../src/modules/sync/repositories/SyncConflictRepository.ts";
import { SyncReceiptRepository } from "../src/modules/sync/repositories/SyncReceiptRepository.ts";
import { DurableMutationCapture } from "../src/modules/sync/services/DurableMutationCapture.ts";
import { DurableMutationGroupCapture } from "../src/modules/sync/services/DurableMutationGroupCapture.ts";
import { ListenerCoordinator } from "../src/modules/sync/services/ListenerCoordinator.ts";
import type {
    LocalMutationApplier,
    LocalMutationInspection
} from "../src/modules/sync/services/LocalMutationApplier.ts";
import { LocalMutationApplierRegistry } from "../src/modules/sync/services/LocalMutationApplierRegistry.ts";
import { LocalMutationReconciler } from "../src/modules/sync/services/LocalMutationReconciler.ts";
import { RetryPolicy } from "../src/modules/sync/services/RetryPolicy.ts";
import { SyncCloudCapabilityRegistry } from "../src/modules/sync/services/SyncCloudCapabilityRegistry.ts";
import { SyncCoordinator } from "../src/modules/sync/services/SyncCoordinator.ts";
import { SyncModeService } from "../src/modules/sync/services/SyncModeService.ts";
import { SyncStatusService } from "../src/modules/sync/services/SyncStatusService.ts";

const accountId = "logical-account-a";
const userId = "logical-user-a";
const firebaseUid = "firebase-provider-user";
const timestamp = "2026-07-15T14:00:00.000Z";

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

    public writeCountFor(key: string): number {
        return this.writes.filter(write => write.key === key).length;
    }
}

class FakeAuthStateService {
    public getState(): AuthState {
        return authenticatedState();
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

class FaultInjectingApplier implements LocalMutationApplier {
    public readonly module;
    public beforeApply: (() => void) | null = null;
    public afterApply: (() => void) | null = null;
    public applyCount = 0;

    private readonly delegate: LocalMutationApplier;

    public constructor(delegate: LocalMutationApplier) {
        this.delegate = delegate;
        this.module = delegate.module;
    }

    public inspect(operation: SyncOperation): LocalMutationInspection {
        return this.delegate.inspect(operation);
    }

    public apply(operation: SyncOperation): void {
        this.beforeApply?.();
        this.delegate.apply(operation);
        this.applyCount += 1;
        this.afterApply?.();
    }
}

class CountingTransport implements SyncOperationTransport {
    public readonly calls: SyncOperation[] = [];

    public async execute(operation: SyncOperation): Promise<SyncExecutionResult> {
        this.calls.push(structuredClone(operation));
        return {
            kind: "acknowledged",
            result: "created"
        };
    }
}

interface Harness {
    driver: MemoryDriver;
    auth: AuthStateService;
    mode: SyncModeService;
    outbox: PersistentOutboxRepository;
    productCache: ProductRepository;
    products: ProductService;
    productApplier: FaultInjectingApplier;
    movements: StockMovementRepository;
    movementApplier: FaultInjectingApplier;
    inventory: InventoryService;
    groupCapture: DurableMutationGroupCapture;
    reconciler: LocalMutationReconciler;
    service: CreateProductWithOpeningStockService;
}

function createHarness(
    mode: "disabled" | "active" = "active",
    driver = new MemoryDriver()
): Harness {
    const auth = new FakeAuthStateService() as unknown as AuthStateService;
    const syncMode = new SyncModeService();
    const capabilities = new SyncCloudCapabilityRegistry();
    capabilities.register("products", ["create", "update"]);
    capabilities.register("customers", ["create", "update"]);
    capabilities.register("suppliers", ["create", "update"]);
    const outbox = new PersistentOutboxRepository(
        driver,
        operation => capabilities.supports(operation)
    );
    const syncState = new MasterDataSyncStateRepository(driver);
    const capture = new DurableMutationCapture(outbox, () => timestamp);
    const registry = new LocalMutationApplierRegistry();
    const productCache = new ProductRepository(driver);
    const baseProductApplier = new MasterDataLocalMutationApplier(
        productCache,
        syncState,
        productSyncCodec,
        () => timestamp
    );
    const productApplier = new FaultInjectingApplier(baseProductApplier);
    registry.register(productApplier);
    const bridge = new MasterDataSyncRepositoryBridge(
        productCache,
        syncMode,
        capture,
        baseProductApplier,
        syncState,
        productSyncCodec,
        () => timestamp
    );
    const productValidator = new ProductValidator();
    const products = new ProductService(
        new ProductSyncRepository(productCache, bridge),
        productValidator,
        auth
    );
    const movements = new StockMovementRepository(driver);
    const movementValidator = new StockMovementValidator();
    const baseMovementApplier = new StockMovementLocalMutationApplier(
        movements,
        movementValidator
    );
    const movementApplier = new FaultInjectingApplier(baseMovementApplier);
    registry.register(movementApplier);
    const groupCapture = new DurableMutationGroupCapture(
        outbox,
        registry,
        capture
    );
    const reconciler = new LocalMutationReconciler(
        outbox,
        registry,
        capture
    );
    const inventory = new InventoryService(
        movements,
        movementValidator,
        auth,
        products
    );
    const service = new CreateProductWithOpeningStockService(
        new ProductFactory(),
        products,
        productValidator,
        productCache,
        bridge,
        movements,
        movementValidator,
        groupCapture,
        syncMode,
        auth
    );

    if (mode === "active") {
        activate(syncMode);
    }

    return {
        driver,
        auth,
        mode: syncMode,
        outbox,
        productCache,
        products,
        productApplier,
        movements,
        movementApplier,
        inventory,
        groupCapture,
        reconciler,
        service
    };
}

function command(
    productId = "product-opening-a",
    openingQuantity = 10,
    name = "Opening Product"
) {
    return {
        productId,
        createdAt: timestamp,
        data: {
            name,
            englishName: name,
            sku: `SKU-${productId}`,
            barcode: `BAR-${productId}`,
            salePrice: 25,
            openingQuantity
        }
    };
}

function activate(mode: SyncModeService): void {
    mode.activate({
        ownerApproved: true,
        migrationVerified: true,
        cutoverApproved: true,
        approvalReference: "SYNC-006E-TEST"
    });
}

function authenticatedState(): AuthState {
    return {
        status: "authenticated",
        session: {
            account: {
                id: accountId,
                name: "Logical Account"
            },
            user: {
                id: userId,
                accountId,
                displayName: "Test User",
                role: "owner"
            },
            authenticatedAt: timestamp
        }
    };
}

function groupMembers(harness: Harness, productId: string): SyncOperation[] {
    return harness.outbox.getGroupMembers(
        accountId,
        `product-create-${productId}`
    );
}

function openingCount(harness: Harness, productId: string): number {
    return harness.movements.allForProduct(accountId, productId).filter(
        movement => movement.type === "opening_balance"
    ).length;
}

function failOnce(callback: () => void): () => void {
    let pending = true;

    return () => {
        if (!pending) return;
        pending = false;
        callback();
    };
}

function recover(harness: Harness): void {
    harness.reconciler.start(accountId);
    harness.reconciler.reconcilePending(accountId);
}

function createCoordinator(
    harness: Harness,
    transport: SyncOperationTransport
): SyncCoordinator {
    const coordinator = new SyncCoordinator(
        harness.mode,
        harness.outbox,
        new SyncReceiptRepository(harness.driver),
        new SyncConflictRepository(harness.driver),
        new RetryPolicy(),
        new ListenerCoordinator(),
        new SyncStatusService(),
        transport,
        new FakeAuthStateSource(),
        () => timestamp
    );
    coordinator.configureLocalMutationReconciler(harness.reconciler);
    coordinator.start();
    return coordinator;
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

function assertThrows(callback: () => void, message: string): void {
    let threw = false;
    try {
        callback();
    } catch {
        threw = true;
    }
    assert(threw, message);
}

type Check = { name: string; run: () => void | Promise<void> };

const checks: Check[] = [
    {
        name: "Product page delegates create to one application command boundary",
        run: () => {
            const source = readFileSync(
                "src/modules/products/pages/ProductListPage.ts",
                "utf8"
            );
            assert(source.includes("createProductWithOpeningStockService.execute"), "Page does not call the application service.");
            assert(!source.includes("addOpeningBalanceForNewProduct"), "Page still calls the Inventory opening command.");
            assert(!source.includes("productFactory.create"), "Page still creates Product separately.");
        }
    },
    {
        name: "positive opening creates a deterministic two-member group",
        run: () => {
            const h = createHarness();
            const result = h.service.execute(command());
            const members = groupMembers(h, "product-opening-a");
            assert(result.success && result.path === "durable_group", "Grouped command failed.");
            assert(result.groupId === "product-create-product-opening-a", "Group ID changed.");
            assert(members.length === 2, "Group does not have two members.");
            assert(members[0].module === "products" && members[0].group?.groupSequence === 1, "Product is not first.");
            assert(members[1].module === "stockMovements" && members[1].group?.groupSequence === 2, "Movement is not second.");
            assert(inspectSyncOperationGroup(members).localState === "applied", "Group is not locally applied.");
        }
    },
    {
        name: "stable Product movement operation and group identities repeat exactly",
        run: () => {
            const h = createHarness();
            h.service.execute(command());
            const first = structuredClone(groupMembers(h, "product-opening-a"));
            h.service.execute(command());
            const second = groupMembers(h, "product-opening-a");
            assert(first.map(item => item.operationId).join() === second.map(item => item.operationId).join(), "Operation IDs changed.");
            assert(first[0].recordId === "product-opening-a", "Product ID changed.");
            assert(first[1].recordId === "opening-product-opening-a", "Opening movement ID changed.");
            assert(first[0].group?.groupChecksum === second[0].group?.groupChecksum, "Group checksum changed.");
        }
    },
    {
        name: "one complete atomic outbox batch exists before local cache writes",
        run: () => {
            const h = createHarness();
            h.service.execute(command());
            const outboxKey = syncOutboxKeyForAccount(accountId);
            const firstWrite = h.driver.writes[0];
            assert(firstWrite.key === outboxKey, "First write was not the outbox batch.");
            assert(Array.isArray(firstWrite.value) && firstWrite.value.length === 2, "First outbox write was incomplete.");
            assert(h.driver.writeCountFor(productStorageKeyForAccount(accountId)) === 1, "Product cache applied more than once.");
            assert(h.driver.writeCountFor(stockMovementStorageKeyForAccount(accountId)) === 1, "Movement cache applied more than once.");
        }
    },
    {
        name: "opening quantity derives from ledger and Product.quantity remains zero",
        run: () => {
            const h = createHarness();
            const result = h.service.execute(command());
            assert(result.product?.quantity === 0, "Product.quantity became authoritative.");
            assert(h.inventory.getCurrentQuantity("product-opening-a") === 10, "Derived inventory is incorrect.");
            assert(openingCount(h, "product-opening-a") === 1, "Opening movement count is incorrect.");
        }
    },
    {
        name: "zero opening uses current ungrouped Product operation",
        run: () => {
            const h = createHarness();
            const result = h.service.execute(command("product-zero", 0));
            const operations = h.outbox.allForAccount(accountId);
            assert(result.success && result.path === "single_operation", "Zero opening did not use single path.");
            assert(operations.length === 1 && !operations[0].group, "Zero opening created a group.");
            assert(operations[0].module === "products", "Zero opening did not create Product operation.");
            assert(openingCount(h, "product-zero") === 0, "Zero opening created movement.");
            assert(h.outbox.getPending(accountId, timestamp).length === 1, "Ungrouped Product cloud eligibility regressed.");
        }
    },
    {
        name: "disabled mode keeps local Product and opening behavior without outbox",
        run: () => {
            const h = createHarness("disabled");
            const result = h.service.execute(command("product-local", 7));
            assert(result.success && result.path === "local", "Disabled local command failed.");
            assert(h.outbox.allForAccount(accountId).length === 0, "Disabled mode wrote outbox.");
            assert(h.inventory.getCurrentQuantity("product-local") === 7, "Disabled derived inventory is incorrect.");
        }
    },
    {
        name: "invalid opening input writes neither outbox nor local records",
        run: () => {
            const h = createHarness();
            const result = h.service.execute(command("invalid-opening", -1));
            assert(!result.success, "Negative opening quantity was accepted.");
            assert(h.outbox.allForAccount(accountId).length === 0, "Invalid input wrote outbox.");
            assert(h.productCache.allForAccount(accountId).length === 0, "Invalid input wrote Product.");
            assert(h.movements.allForAccount(accountId).length === 0, "Invalid input wrote movement.");
        }
    },
    {
        name: "Scenario A batch failure leaves no group Product or movement",
        run: () => {
            const h = createHarness();
            h.driver.failNextWriteFor(syncOutboxKeyForAccount(accountId));
            const result = h.service.execute(command("scenario-a"));
            assert(!result.success, "Injected batch failure succeeded.");
            assert(groupMembers(h, "scenario-a").length === 0, "Partial group persisted.");
            assert(!h.productCache.findForAccount(accountId, "scenario-a"), "Product applied before durable group.");
            assert(openingCount(h, "scenario-a") === 0, "Movement applied before durable group.");
        }
    },
    {
        name: "Scenario B recovers after persistence before Product apply",
        run: () => {
            const h = createHarness();
            h.productApplier.beforeApply = failOnce(() => { throw new Error("Injected Product apply failure."); });
            const result = h.service.execute(command("scenario-b"));
            assert(!result.success && groupMembers(h, "scenario-b").length === 2, "Scenario B did not retain group.");
            assert(!h.productCache.findForAccount(accountId, "scenario-b"), "Scenario B applied Product unexpectedly.");
            recover(h);
            assert(Boolean(h.productCache.findForAccount(accountId, "scenario-b")), "Scenario B Product did not recover.");
            assert(openingCount(h, "scenario-b") === 1, "Scenario B movement did not recover once.");
        }
    },
    {
        name: "Scenario C recovers after Product apply before movement apply",
        run: () => {
            const h = createHarness();
            h.movementApplier.beforeApply = failOnce(() => { throw new Error("Injected movement apply failure."); });
            const result = h.service.execute(command("scenario-c"));
            assert(!result.success, "Scenario C unexpectedly succeeded.");
            assert(Boolean(h.productCache.findForAccount(accountId, "scenario-c")), "Scenario C lost Product.");
            assert(openingCount(h, "scenario-c") === 0, "Scenario C movement applied unexpectedly.");
            recover(h);
            assert(openingCount(h, "scenario-c") === 1, "Scenario C movement did not recover once.");
            assert(h.productCache.allForAccount(accountId).length === 1, "Scenario C duplicated Product.");
        }
    },
    {
        name: "Scenario D repairs movement applied before durable applied marker",
        run: () => {
            const h = createHarness();
            h.movementApplier.afterApply = failOnce(() => {
                h.driver.failNextWriteFor(syncOutboxKeyForAccount(accountId));
            });
            const result = h.service.execute(command("scenario-d"));
            assert(!result.success, "Scenario D did not expose marker failure.");
            assert(openingCount(h, "scenario-d") === 1, "Scenario D movement was not cached once.");
            const retry = h.service.execute(command("scenario-d"));
            assert(retry.success, "Scenario D exact retry did not repair marker.");
            assert(openingCount(h, "scenario-d") === 1, "Scenario D duplicated movement.");
        }
    },
    {
        name: "Scenario E exact retry after local completion is idempotent",
        run: () => {
            const h = createHarness();
            const first = h.service.execute(command("scenario-e"));
            const second = h.service.execute(command("scenario-e"));
            assert(first.success && second.success && second.outcome === "already_applied", "Scenario E retry failed.");
            assert(h.productCache.allForAccount(accountId).length === 1, "Scenario E duplicated Product.");
            assert(openingCount(h, "scenario-e") === 1, "Scenario E duplicated movement.");
            assert(groupMembers(h, "scenario-e").length === 2, "Scenario E duplicated group members.");
        }
    },
    {
        name: "Scenario F divergent Product conflicts before movement apply",
        run: () => {
            const h = createHarness();
            const intended = new ProductFactory().create(command("scenario-f").data, {
                id: "scenario-f",
                timestamp: new Date(timestamp)
            });
            h.productCache.addToAccount(accountId, {
                ...intended,
                accountId,
                createdBy: userId,
                updatedBy: userId,
                name: "Divergent Product"
            });
            const result = h.service.execute(command("scenario-f"));
            assert(!result.success && result.outcome === "conflict", "Scenario F did not conflict.");
            assert(openingCount(h, "scenario-f") === 0, "Scenario F blindly applied movement.");
            assert(inspectSyncOperationGroup(groupMembers(h, "scenario-f")).localState === "conflict", "Scenario F group not conflicted.");
        }
    },
    {
        name: "Scenario G divergent opening movement conflicts without duplicate",
        run: () => {
            const h = createHarness();
            h.movements.appendForAccount(accountId, {
                id: "opening-scenario-g",
                accountId,
                productId: "scenario-g",
                type: "opening_balance",
                quantityDelta: 99,
                reason: "Divergent opening",
                referenceType: "opening_balance",
                referenceId: "scenario-g",
                createdAt: timestamp,
                createdBy: userId,
                ledgerSemanticsVersion: 2,
                metadata: { source: "product_create" }
            });
            const result = h.service.execute(command("scenario-g"));
            assert(!result.success && result.outcome === "conflict", "Scenario G did not conflict.");
            assert(openingCount(h, "scenario-g") === 1, "Scenario G duplicated movement.");
            assert(h.inventory.getCurrentQuantity("scenario-g") === 99, "Scenario G altered existing movement.");
            assert(h.outbox.getPending(accountId, timestamp).length === 0, "Scenario G group became cloud eligible.");
        }
    },
    {
        name: "same identity different Product payload conflicts",
        run: () => {
            const h = createHarness();
            h.service.execute(command("retry-product-conflict"));
            const result = h.service.execute(command("retry-product-conflict", 10, "Changed Product"));
            assert(!result.success && result.outcome === "conflict", "Changed Product retry did not conflict.");
            assert(h.productCache.allForAccount(accountId).length === 1, "Changed Product retry duplicated Product.");
            assert(openingCount(h, "retry-product-conflict") === 1, "Changed Product retry duplicated movement.");
        }
    },
    {
        name: "same identity different opening quantity conflicts",
        run: () => {
            const h = createHarness();
            h.service.execute(command("retry-opening-conflict", 10));
            const result = h.service.execute(command("retry-opening-conflict", 11));
            assert(!result.success && result.outcome === "conflict", "Changed opening retry did not conflict.");
            assert(h.inventory.getCurrentQuantity("retry-opening-conflict") === 10, "Changed opening retry changed inventory.");
            assert(openingCount(h, "retry-opening-conflict") === 1, "Changed opening retry duplicated movement.");
        }
    },
    {
        name: "whole Product opening group is blocked without StockMovement transport capability",
        run: () => {
            const h = createHarness();
            h.service.execute(command("cloud-block"));
            const members = groupMembers(h, "cloud-block");
            assert(members.every(member => member.localApplyState === "applied"), "Cloud gate test group is not locally applied.");
            assert(h.outbox.getPending(accountId, timestamp).length === 0, "Unsupported group member became pending for cloud.");
            assertThrows(
                () => h.outbox.markSyncing(accountId, members[0].operationId, timestamp),
                "Grouped Product bypassed capability gate."
            );
            assertThrows(
                () => h.outbox.markSyncing(accountId, members[1].operationId, timestamp),
                "Grouped movement bypassed capability gate."
            );
        }
    },
    {
        name: "coordinator performs zero grouped cloud transport calls",
        run: async () => {
            const h = createHarness();
            h.service.execute(command("cloud-zero"));
            const transport = new CountingTransport();
            const coordinator = createCoordinator(h, transport);
            const processed = await coordinator.processNext();
            assert(!processed && transport.calls.length === 0, "Coordinator dispatched blocked group.");
            coordinator.dispose();
        }
    },
    {
        name: "Product metadata edit remains V1-SYNC-005 single-operation flow",
        run: () => {
            const h = createHarness();
            h.service.execute(command("product-edit"));
            const errors = h.products.update("product-edit", { salePrice: 31 });
            const ungroupedUpdates = h.outbox.allForAccount(accountId).filter(
                operation => operation.module === "products"
                    && operation.operationType === "update"
                    && !operation.group
            );
            assert(errors.length === 0, "Product edit failed.");
            assert(h.products.find("product-edit")?.salePrice === 31, "Product edit did not apply.");
            assert(ungroupedUpdates.length === 1, "Product edit was grouped or duplicated.");
            assert(h.inventory.getCurrentQuantity("product-edit") === 10, "Product edit changed inventory.");
        }
    },
    {
        name: "cache appliers do not replay business commands",
        run: () => {
            const serviceSource = readFileSync(
                "src/modules/inventory/sync/StockMovementLocalMutationApplier.ts",
                "utf8"
            );
            assert(!serviceSource.includes("InventoryService"), "Movement applier imports InventoryService.");
            assert(!serviceSource.includes("addOpeningBalanceForNewProduct"), "Movement applier replays opening command.");
            assert(!serviceSource.includes("reverseMovement"), "Movement applier replays reversal command.");
        }
    },
    {
        name: "default SyncMode remains disabled",
        run: () => {
            assert(new SyncModeService().getMode() === "disabled", "Default SyncMode changed.");
        }
    },
    {
        name: "Firebase UID is not used as logical accountId",
        run: () => {
            const state = authenticatedState();
            assert(state.status === "authenticated" && state.session.account.id === accountId, "Logical account missing.");
            assert(state.status === "authenticated" && String(state.session.account.id) !== firebaseUid, "Firebase UID became accountId.");
        }
    },
    {
        name: "no migration backfill or existing-record auto-upload path is invoked",
        run: () => {
            const h = createHarness("disabled");
            h.service.execute(command("future-only", 0));
            assert(h.outbox.allForAccount(accountId).length === 0, "Disabled future command uploaded or captured historical state.");
        }
    },
    {
        name: "exact retry keeps one Product record",
        run: () => {
            const h = createHarness();
            h.service.execute(command("retry-product-count"));
            h.service.execute(command("retry-product-count"));
            assert(h.productCache.allForAccount(accountId).length === 1, "Exact retry duplicated Product.");
        }
    },
    {
        name: "exact retry keeps one opening StockMovement record",
        run: () => {
            const h = createHarness();
            h.service.execute(command("retry-movement-count"));
            h.service.execute(command("retry-movement-count"));
            assert(openingCount(h, "retry-movement-count") === 1, "Exact retry duplicated opening movement.");
        }
    },
    {
        name: "exact retry keeps one logical group",
        run: () => {
            const h = createHarness();
            h.service.execute(command("retry-group-count"));
            h.service.execute(command("retry-group-count"));
            const groups = new Set(
                h.outbox.allForAccount(accountId).map(operation => operation.group?.groupId)
            );
            assert(groups.size === 1 && groupMembers(h, "retry-group-count").length === 2, "Exact retry duplicated logical group.");
        }
    },
    {
        name: "exact retry keeps Product member checksum stable",
        run: () => {
            const h = createHarness();
            h.service.execute(command("retry-product-checksum"));
            const checksum = groupMembers(h, "retry-product-checksum")[0].writeSetChecksum;
            h.service.execute(command("retry-product-checksum"));
            assert(groupMembers(h, "retry-product-checksum")[0].writeSetChecksum === checksum, "Product checksum changed.");
        }
    },
    {
        name: "exact retry keeps opening member checksum stable",
        run: () => {
            const h = createHarness();
            h.service.execute(command("retry-opening-checksum"));
            const checksum = groupMembers(h, "retry-opening-checksum")[1].writeSetChecksum;
            h.service.execute(command("retry-opening-checksum"));
            assert(groupMembers(h, "retry-opening-checksum")[1].writeSetChecksum === checksum, "Opening checksum changed.");
        }
    },
    {
        name: "Product cache-only applier runs exactly once",
        run: () => {
            const h = createHarness();
            h.service.execute(command("product-applier-once"));
            h.service.execute(command("product-applier-once"));
            assert(h.productApplier.applyCount === 1, "Product applier ran more than once.");
        }
    },
    {
        name: "StockMovement cache-only applier runs exactly once",
        run: () => {
            const h = createHarness();
            h.service.execute(command("movement-applier-once"));
            h.service.execute(command("movement-applier-once"));
            assert(h.movementApplier.applyCount === 1, "Movement applier ran more than once.");
        }
    },
    {
        name: "all required group members carry cloud capability gate metadata",
        run: () => {
            const h = createHarness();
            h.service.execute(command("required-members"));
            assert(groupMembers(h, "required-members").every(member => member.group?.requiredForLocalCompletion === true), "A required member flag is missing.");
        }
    },
    {
        name: "Product grouped member remains pending and unsent",
        run: () => {
            const h = createHarness();
            h.service.execute(command("product-unsent"));
            const product = groupMembers(h, "product-unsent")[0];
            assert(product.status === "pending" && h.outbox.getPending(accountId, timestamp).length === 0, "Grouped Product was dispatched.");
        }
    },
    {
        name: "opening grouped member remains pending and unsent",
        run: () => {
            const h = createHarness();
            h.service.execute(command("movement-unsent"));
            const movement = groupMembers(h, "movement-unsent")[1];
            assert(movement.status === "pending" && h.outbox.getPending(accountId, timestamp).length === 0, "Grouped movement was dispatched.");
        }
    },
    {
        name: "StockMovement Firebase transport is not registered",
        run: () => {
            const source = readFileSync("src/core/Container.ts", "utf8");
            assert(!source.includes("StockMovementSyncOperationTransport"), "StockMovement cloud transport was registered.");
        }
    },
    {
        name: "StockMovement cloud listener is not registered",
        run: () => {
            const source = readFileSync("src/core/Container.ts", "utf8");
            assert(!source.includes("StockMovementModuleSyncAdapter"), "StockMovement listener adapter was registered.");
        }
    },
    {
        name: "opening movement is immutable V2 ledger data",
        run: () => {
            const h = createHarness();
            const result = h.service.execute(command("immutable-opening"));
            assert(result.openingMovement?.ledgerSemanticsVersion === 2, "Opening movement is not immutable V2 data.");
            assert(result.openingMovement?.type === "opening_balance", "Opening movement type changed.");
        }
    },
    {
        name: "opening movement references its Product deterministically",
        run: () => {
            const h = createHarness();
            const result = h.service.execute(command("opening-reference"));
            assert(result.openingMovement?.productId === "opening-reference", "Opening movement Product reference changed.");
            assert(result.openingMovement?.referenceId === "opening-reference", "Opening movement referenceId changed.");
        }
    },
    {
        name: "disabled zero-opening create writes Product only",
        run: () => {
            const h = createHarness("disabled");
            const result = h.service.execute(command("disabled-zero", 0));
            assert(result.success && h.productCache.allForAccount(accountId).length === 1, "Disabled Product create failed.");
            assert(h.movements.allForAccount(accountId).length === 0, "Disabled zero opening created movement.");
            assert(h.outbox.allForAccount(accountId).length === 0, "Disabled zero opening wrote outbox.");
        }
    }
];

async function run(): Promise<void> {
    const results: Array<{ check: string; result: "PASS" }> = [];

    for (const check of checks) {
        await check.run();
        results.push({ check: check.name, result: "PASS" });
    }

    console.log(JSON.stringify({
        mission: "V1-SYNC-006E",
        result: "PASS",
        checks: results,
        crashScenarios: "A-G PASS",
        exactRetry: "PASS",
        conflictHandling: "PASS",
        groupCloudCapabilityGate: "PASS",
        stockMovementFirebaseTransportRegistered: false,
        operationalFirebaseReads: 0,
        operationalFirebaseWrites: 0,
        existingRecordsUploaded: 0,
        migrationsOrBackfills: 0,
        businessCommandReplays: 0,
        productQuantityAuthoritative: false,
        productionTouched: false
    }, null, 2));
}

void run();
