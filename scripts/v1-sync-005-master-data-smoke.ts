import type { Driver } from "../src/core/persistence/Driver.ts";
import type { Product } from "../src/modules/products/Product.ts";
import { productStorageKeyForAccount } from "../src/modules/products/persistence/ProductPersistenceKey.ts";
import { ProductRepository } from "../src/modules/products/repositories/ProductRepository.ts";
import { productSyncCodec } from "../src/modules/products/sync/ProductSyncCodec.ts";
import type { Customer } from "../src/modules/customers/Customer.ts";
import { CustomerRepository } from "../src/modules/customers/repositories/CustomerRepository.ts";
import { customerSyncCodec } from "../src/modules/customers/sync/CustomerSyncCodec.ts";
import type { Supplier } from "../src/modules/suppliers/Supplier.ts";
import { SupplierRepository } from "../src/modules/suppliers/repositories/SupplierRepository.ts";
import { supplierSyncCodec } from "../src/modules/suppliers/sync/SupplierSyncCodec.ts";
import { stockMovementStorageKeyForAccount } from "../src/modules/inventory/persistence/StockMovementPersistenceKey.ts";
import type { AuthState } from "../src/modules/auth/AuthState.ts";
import type { SyncAuthStateSource } from "../src/modules/sync/SyncContracts.ts";
import type { SyncOperation } from "../src/modules/sync/SyncOperation.ts";
import { createMasterDataEnvelope, masterDataCloudReceiptPath, masterDataRecordPath, type MasterDataCacheRepository, type MasterDataCloudEnvelope, type MasterDataRecordCodec } from "../src/modules/sync/master-data/MasterDataSyncTypes.ts";
import { MasterDataLocalMutationApplier } from "../src/modules/sync/master-data/MasterDataLocalMutationApplier.ts";
import { MasterDataModuleSyncAdapter } from "../src/modules/sync/master-data/MasterDataModuleSyncAdapter.ts";
import { MasterDataSyncOperationTransport, type MasterDataRealtimeStore } from "../src/modules/sync/master-data/MasterDataSyncOperationTransport.ts";
import { MasterDataSyncRepositoryBridge } from "../src/modules/sync/master-data/MasterDataSyncRepositoryBridge.ts";
import { masterDataSyncStateKeyForAccount, MasterDataSyncStateRepository } from "../src/modules/sync/repositories/MasterDataSyncStateRepository.ts";
import { PersistentOutboxRepository } from "../src/modules/sync/repositories/PersistentOutboxRepository.ts";
import { SyncConflictRepository } from "../src/modules/sync/repositories/SyncConflictRepository.ts";
import { SyncReceiptRepository } from "../src/modules/sync/repositories/SyncReceiptRepository.ts";
import { syncOutboxKeyForAccount } from "../src/modules/sync/persistence/SyncPersistenceKeys.ts";
import { DurableMutationCapture } from "../src/modules/sync/services/DurableMutationCapture.ts";
import { ListenerCoordinator } from "../src/modules/sync/services/ListenerCoordinator.ts";
import { LocalMutationApplierRegistry } from "../src/modules/sync/services/LocalMutationApplierRegistry.ts";
import { LocalMutationReconciler } from "../src/modules/sync/services/LocalMutationReconciler.ts";
import { RetryPolicy } from "../src/modules/sync/services/RetryPolicy.ts";
import { SyncCoordinator } from "../src/modules/sync/services/SyncCoordinator.ts";
import { SyncEchoPolicy } from "../src/modules/sync/services/SyncEchoPolicy.ts";
import { SyncModeService } from "../src/modules/sync/services/SyncModeService.ts";
import { SyncStatusService } from "../src/modules/sync/services/SyncStatusService.ts";

const accountA = "logical-account-a";
const accountB = "logical-account-b";
const providerUserId = "firebase-provider-user";
const now = "2026-07-14T12:00:00.000Z";

class MemoryDriver implements Driver {
    private readonly values = new Map<string, unknown>();
    private failNextKey: string | null = null;

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

        this.values.set(key, structuredClone(value));
    }

    public remove(key: string): void {
        this.values.delete(key);
    }

    public clear(): void {
        this.values.clear();
    }

    public failNextWrite(key: string): void {
        this.failNextKey = key;
    }
}

class FakeAuthStateSource implements SyncAuthStateSource {
    private state: AuthState;
    private readonly subscribers = new Set<(state: AuthState) => void>();

    public constructor(accountId = accountA) {
        this.state = authenticatedState(accountId);
    }

    public getState(): AuthState {
        return this.state;
    }

    public subscribe(subscriber: (state: AuthState) => void): () => void {
        this.subscribers.add(subscriber);
        return () => this.subscribers.delete(subscriber);
    }

    public setState(state: AuthState): void {
        this.state = state;
        for (const subscriber of this.subscribers) {
            subscriber(state);
        }
    }
}

class FakeRealtimeStore implements MasterDataRealtimeStore {
    private readonly values = new Map<string, unknown>();
    public writeCount = 0;
    public listenerCount = 0;

    public async read<T>(path: string): Promise<T | null> {
        return this.values.has(path)
            ? structuredClone(this.values.get(path)) as T
            : null;
    }

    public async updateChildren(
        path: string,
        values: Record<string, unknown>
    ): Promise<void> {
        this.writeCount += 1;
        for (const [childPath, value] of Object.entries(values)) {
            this.values.set(`${path}/${childPath}`, resolveTimestamp(value));
        }
    }

    public serverTimestampValue(): object {
        return { ".sv": "timestamp" };
    }

    public subscribe<T>(
        _path: string,
        _callback: (value: T | null) => void
    ): () => void {
        this.listenerCount += 1;
        return () => {
            this.listenerCount -= 1;
        };
    }

    public set(path: string, value: unknown): void {
        this.values.set(path, structuredClone(value));
    }

    public remove(path: string): void {
        this.values.delete(path);
    }
}

interface ModuleHarness<T extends object> {
    driver: MemoryDriver;
    cache: MasterDataCacheRepository<T>;
    outbox: PersistentOutboxRepository;
    state: MasterDataSyncStateRepository;
    mode: SyncModeService;
    capture: DurableMutationCapture;
    applier: MasterDataLocalMutationApplier<T>;
    bridge: MasterDataSyncRepositoryBridge<T>;
}

function createHarness<T extends object>(
    cacheFactory: (driver: Driver) => MasterDataCacheRepository<T>,
    codec: MasterDataRecordCodec<T>,
    driver = new MemoryDriver()
): ModuleHarness<T> {
    const cache = cacheFactory(driver);
    const outbox = new PersistentOutboxRepository(driver);
    const state = new MasterDataSyncStateRepository(driver);
    const mode = new SyncModeService();
    const capture = new DurableMutationCapture(outbox, () => now);
    const applier = new MasterDataLocalMutationApplier(cache, state, codec, () => now);
    const bridge = new MasterDataSyncRepositoryBridge(
        cache,
        mode,
        capture,
        applier,
        state,
        codec,
        () => now
    );

    return { driver, cache, outbox, state, mode, capture, applier, bridge };
}

function activate(mode: SyncModeService): void {
    mode.activate({
        ownerApproved: true,
        migrationVerified: true,
        cutoverApproved: true,
        approvalReference: "sync-005-smoke-only"
    });
}

function product(id = "product-1", accountId = accountA): Product {
    return {
        id,
        accountId,
        sku: `SKU-${id}`,
        barcode: `BAR-${id}`,
        name: `Product ${id}`,
        description: "",
        images: [],
        category: "QA",
        brand: "QA",
        unit: "unit",
        purchasePrice: 10,
        salePrice: 15,
        taxRate: 0,
        quantity: 99,
        minimumQuantity: 1,
        isActive: true,
        createdAt: new Date(now),
        updatedAt: new Date(now),
        createdBy: "user-a",
        updatedBy: "user-a",
        isDeleted: false
    };
}

function customer(id = "customer-1", accountId = accountA): Customer {
    return {
        id,
        accountId,
        displayName: `Customer ${id}`,
        status: "active",
        createdAt: now,
        createdBy: "user-a",
        updatedAt: now,
        updatedBy: "user-a",
        isDeleted: false
    };
}

function supplier(id = "supplier-1", accountId = accountA): Supplier {
    return {
        id,
        accountId,
        displayName: `Supplier ${id}`,
        status: "active",
        createdAt: now,
        createdBy: "user-a",
        updatedAt: now,
        updatedBy: "user-a",
        isDeleted: false
    };
}

function authenticatedState(accountId: string): AuthState {
    return {
        status: "authenticated",
        session: {
            account: { id: accountId, name: "Logical account" },
            user: {
                id: providerUserId,
                accountId,
                displayName: "QA user",
                role: "owner"
            },
            authenticatedAt: now
        }
    };
}

function operationFor<T extends object>(harness: ModuleHarness<T>, index = 0): SyncOperation {
    const operation = harness.outbox.allForAccount(accountA)[index];
    if (!operation) {
        throw new Error("Expected captured operation was not found.");
    }
    return operation;
}

function adapterFor<T extends object>(
    harness: ModuleHarness<T>,
    store: FakeRealtimeStore,
    auth: FakeAuthStateSource,
    codec: MasterDataRecordCodec<T>,
    listeners = new ListenerCoordinator()
): MasterDataModuleSyncAdapter<T> {
    return new MasterDataModuleSyncAdapter(
        store,
        harness.mode,
        auth,
        harness.outbox,
        new SyncConflictRepository(harness.driver),
        new SyncReceiptRepository(harness.driver),
        listeners,
        new SyncEchoPolicy(),
        harness.applier,
        codec
    );
}

const checks: Array<{ name: string; run: () => void | Promise<void> }> = [];
function check(name: string, run: () => void | Promise<void>): void {
    checks.push({ name, run });
}

check("default sync mode is disabled", () => {
    equal(new SyncModeService().getMode(), "disabled");
});

check("disabled Product create is local-only", () => {
    const h = createHarness(driver => new ProductRepository(driver), productSyncCodec);
    h.bridge.addToAccount(accountA, product());
    equal(h.cache.findForAccount(accountA, "product-1")?.id, "product-1");
    equal(h.outbox.allForAccount(accountA).length, 0);
});

check("disabled Customer create is local-only", () => {
    const h = createHarness(driver => new CustomerRepository(driver), customerSyncCodec);
    h.bridge.addToAccount(accountA, customer());
    equal(h.outbox.allForAccount(accountA).length, 0);
});

check("disabled Supplier create is local-only", () => {
    const h = createHarness(driver => new SupplierRepository(driver), supplierSyncCodec);
    h.bridge.addToAccount(accountA, supplier());
    equal(h.outbox.allForAccount(accountA).length, 0);
});

check("active Product create captures exactly one applied operation", () => {
    const h = createHarness(driver => new ProductRepository(driver), productSyncCodec);
    activate(h.mode);
    h.bridge.addToAccount(accountA, product());
    equal(h.outbox.allForAccount(accountA).length, 1);
    equal(operationFor(h).localApplyState, "applied");
});

check("active Customer create captures exactly one operation", () => {
    const h = createHarness(driver => new CustomerRepository(driver), customerSyncCodec);
    activate(h.mode);
    h.bridge.addToAccount(accountA, customer());
    equal(h.outbox.allForAccount(accountA).length, 1);
});

check("active Supplier create captures exactly one operation", () => {
    const h = createHarness(driver => new SupplierRepository(driver), supplierSyncCodec);
    activate(h.mode);
    h.bridge.addToAccount(accountA, supplier());
    equal(h.outbox.allForAccount(accountA).length, 1);
});

check("outbox failure prevents Product cache mutation", () => {
    const h = createHarness(driver => new ProductRepository(driver), productSyncCodec);
    activate(h.mode);
    h.driver.failNextWrite(syncOutboxKeyForAccount(accountA));
    throws(() => h.bridge.addToAccount(accountA, product()));
    equal(h.cache.findForAccount(accountA, "product-1"), undefined);
});

check("local apply failure retains durable operation and blocks cloud", () => {
    const driver = new MemoryDriver();
    const real = new ProductRepository(driver);
    const failing: MasterDataCacheRepository<Product> = {
        findForAccount: (accountId, id) => real.findForAccount(accountId, id),
        addToAccount: () => { throw new Error("Injected cache failure."); },
        updateForAccount: (accountId, id, data) => real.updateForAccount(accountId, id, data)
    };
    const h = createHarness(() => failing, productSyncCodec, driver);
    activate(h.mode);
    throws(() => h.bridge.addToAccount(accountA, product()));
    equal(h.outbox.allForAccount(accountA).length, 1);
    equal(operationFor(h).localApplyState, "failed");
    equal(h.outbox.getPending(accountA, now).length, 0);
});

check("crash after outbox before cache reconciles Product once", () => {
    const h = createHarness(driver => new ProductRepository(driver), productSyncCodec);
    activate(h.mode);
    h.bridge.addToAccount(accountA, product());
    const pending = { ...operationFor(h), localApplyState: "pending" as const, localAppliedAt: undefined };
    h.driver.remove(productStorageKeyForAccount(accountA));
    h.driver.remove(masterDataSyncStateKeyForAccount(accountA));
    h.driver.write(syncOutboxKeyForAccount(accountA), [pending]);
    const result = h.capture.applyPersistedOperation(pending, h.applier);
    equal(result.success, true);
    equal(h.cache.findForAccount(accountA, "product-1")?.id, "product-1");
});

check("crash after cache before marker does not duplicate Product", () => {
    const h = createHarness(driver => new ProductRepository(driver), productSyncCodec);
    activate(h.mode);
    h.bridge.addToAccount(accountA, product());
    const pending = { ...operationFor(h), localApplyState: "pending" as const, localAppliedAt: undefined };
    h.driver.write(syncOutboxKeyForAccount(accountA), [pending]);
    const result = h.capture.applyPersistedOperation(pending, h.applier);
    equal(result.success, true);
    equal((h.driver.read<Product[]>(productStorageKeyForAccount(accountA)) ?? []).length, 1);
});

check("same Product operation retry is idempotent", () => {
    const h = createHarness(driver => new ProductRepository(driver), productSyncCodec);
    activate(h.mode);
    h.bridge.addToAccount(accountA, product());
    h.bridge.addToAccount(accountA, product());
    equal(h.outbox.allForAccount(accountA).length, 1);
    equal((h.driver.read<Product[]>(productStorageKeyForAccount(accountA)) ?? []).length, 1);
});

check("cloud create and exact retry are idempotent", async () => {
    const h = createHarness(driver => new ProductRepository(driver), productSyncCodec);
    activate(h.mode);
    h.bridge.addToAccount(accountA, product());
    const operation = operationFor(h);
    const store = new FakeRealtimeStore();
    const transport = new MasterDataSyncOperationTransport(store, () => "abonibal-erp-test");
    const first = await transport.execute(operation);
    equal(first.kind, "acknowledged");
    equal(store.writeCount, 1);
    store.remove(masterDataCloudReceiptPath(accountA, operation.operationId));
    const retry = await transport.execute(operation);
    equal(retry.kind, "acknowledged");
    equal(store.writeCount, 1);
});

check("coordinator persists receipt before outbox removal", async () => {
    const h = createHarness(driver => new ProductRepository(driver), productSyncCodec);
    activate(h.mode);
    h.bridge.addToAccount(accountA, product());
    const operation = operationFor(h);
    const store = new FakeRealtimeStore();
    const transport = new MasterDataSyncOperationTransport(store, () => "abonibal-erp-test");
    const receipts = new SyncReceiptRepository(h.driver);
    const conflicts = new SyncConflictRepository(h.driver);
    const listeners = new ListenerCoordinator();
    const status = new SyncStatusService();
    const auth = new FakeAuthStateSource();
    const registry = new LocalMutationApplierRegistry();
    registry.register(h.applier);
    const reconciler = new LocalMutationReconciler(h.outbox, registry, h.capture);
    const coordinator = new SyncCoordinator(
        h.mode,
        h.outbox,
        receipts,
        conflicts,
        new RetryPolicy(),
        listeners,
        status,
        transport,
        auth,
        () => now
    );
    coordinator.configureLocalMutationReconciler(reconciler);
    coordinator.start();
    await coordinator.processNext();
    equal(Boolean(receipts.findByOperationId(accountA, operation.operationId)), true);
    equal(h.outbox.allForAccount(accountA).length, 0);
    coordinator.dispose();
});

check("valid Product revision update is acknowledged", async () => {
    const h = createHarness(driver => new ProductRepository(driver), productSyncCodec);
    activate(h.mode);
    h.bridge.addToAccount(accountA, product());
    h.bridge.updateForAccount(accountA, "product-1", { salePrice: 22 });
    const store = new FakeRealtimeStore();
    const transport = new MasterDataSyncOperationTransport(store, () => "abonibal-erp-test");
    await transport.execute(operationFor(h, 0));
    const result = await transport.execute(operationFor(h, 1));
    equal(result.kind, "acknowledged");
    equal(result.kind === "acknowledged" ? result.cloudRevision : -1, 2);
});

check("stale Product revision returns conflict", async () => {
    const h = createHarness(driver => new ProductRepository(driver), productSyncCodec);
    activate(h.mode);
    h.bridge.addToAccount(accountA, product());
    h.bridge.updateForAccount(accountA, "product-1", { salePrice: 22 });
    const update = operationFor(h, 1);
    const payload = update.safePayload as { envelope: MasterDataCloudEnvelope };
    const newer = createMasterDataEnvelope(
        { ...payload.envelope.data, salePrice: 30 },
        3,
        "other-operation",
        false
    );
    const store = new FakeRealtimeStore();
    store.set(masterDataRecordPath(accountA, "products", "product-1"), newer);
    const result = await new MasterDataSyncOperationTransport(
        store,
        () => "abonibal-erp-test"
    ).execute(update);
    equal(result.kind, "conflict");
});

check("Product pull is cache-only and creates no StockMovement", async () => {
    const h = createHarness(driver => new ProductRepository(driver), productSyncCodec);
    activate(h.mode);
    const store = new FakeRealtimeStore();
    const remote = createMasterDataEnvelope(productSyncCodec.toCloudRecord(product()), 1, "remote-product", false);
    store.set(masterDataRecordPath(accountA, "products", "product-1"), remote);
    const result = await adapterFor(h, store, new FakeAuthStateSource(), productSyncCodec)
        .pullRecord(accountA, "product-1");
    equal(result.outcome, "applied");
    equal(h.cache.findForAccount(accountA, "product-1")?.id, "product-1");
    equal((h.driver.read<unknown[]>(stockMovementStorageKeyForAccount(accountA)) ?? []).length, 0);
});

check("Product quantity stays descriptive and does not create inventory truth", () => {
    const h = createHarness(driver => new ProductRepository(driver), productSyncCodec);
    h.cache.addToAccount(accountA, product());
    equal(h.cache.findForAccount(accountA, "product-1")?.quantity, 99);
    equal((h.driver.read<unknown[]>(stockMovementStorageKeyForAccount(accountA)) ?? []).length, 0);
});

check("Customer pull is cache-only", async () => {
    const h = createHarness(driver => new CustomerRepository(driver), customerSyncCodec);
    activate(h.mode);
    const store = new FakeRealtimeStore();
    store.set(masterDataRecordPath(accountA, "customers", "customer-1"), createMasterDataEnvelope(customerSyncCodec.toCloudRecord(customer()), 1, "remote-customer", false));
    equal((await adapterFor(h, store, new FakeAuthStateSource(), customerSyncCodec).pullRecord(accountA, "customer-1")).outcome, "applied");
});

check("Supplier pull is cache-only", async () => {
    const h = createHarness(driver => new SupplierRepository(driver), supplierSyncCodec);
    activate(h.mode);
    const store = new FakeRealtimeStore();
    store.set(masterDataRecordPath(accountA, "suppliers", "supplier-1"), createMasterDataEnvelope(supplierSyncCodec.toCloudRecord(supplier()), 1, "remote-supplier", false));
    equal((await adapterFor(h, store, new FakeAuthStateSource(), supplierSyncCodec).pullRecord(accountA, "supplier-1")).outcome, "applied");
});

check("Customer valid update captures revision 2", () => {
    const h = createHarness(driver => new CustomerRepository(driver), customerSyncCodec);
    activate(h.mode);
    h.bridge.addToAccount(accountA, customer());
    h.bridge.updateForAccount(accountA, "customer-1", { displayName: "Updated" });
    equal(operationFor(h, 1).expectedRevision, 1);
});

check("Supplier valid update captures revision 2", () => {
    const h = createHarness(driver => new SupplierRepository(driver), supplierSyncCodec);
    activate(h.mode);
    h.bridge.addToAccount(accountA, supplier());
    h.bridge.updateForAccount(accountA, "supplier-1", { displayName: "Updated" });
    equal(operationFor(h, 1).expectedRevision, 1);
});

check("safe delete is a revisioned tombstone update", () => {
    const h = createHarness(driver => new CustomerRepository(driver), customerSyncCodec);
    activate(h.mode);
    h.bridge.addToAccount(accountA, customer());
    h.bridge.updateForAccount(accountA, "customer-1", { isDeleted: true, deletedAt: now, deletedBy: "user-a" });
    const payload = operationFor(h, 1).safePayload as { envelope: MasterDataCloudEnvelope };
    equal(payload.envelope.meta.tombstone, true);
    equal(operationFor(h, 1).operationType, "update");
});

check("pull cannot cross logical account boundary", async () => {
    const h = createHarness(driver => new CustomerRepository(driver), customerSyncCodec);
    activate(h.mode);
    const adapter = adapterFor(h, new FakeRealtimeStore(), new FakeAuthStateSource(accountA), customerSyncCodec);
    await rejects(() => adapter.pullRecord(accountB, "customer-1"));
});

check("Firebase provider user ID is never the operational accountId", () => {
    const auth = new FakeAuthStateSource();
    const state = auth.getState();
    if (state.status !== "authenticated") throw new Error("Expected auth state.");
    equal(state.session.user.id, providerUserId);
    equal(state.session.account.id, accountA);
    equal(state.session.user.id === state.session.account.id, false);
});

check("logout removes active listeners", () => {
    const h = createHarness(driver => new CustomerRepository(driver), customerSyncCodec);
    activate(h.mode);
    const listeners = new ListenerCoordinator();
    const auth = new FakeAuthStateSource();
    const coordinator = coordinatorFor(h, new FakeRealtimeStore(), auth, listeners);
    coordinator.start();
    listeners.register("qa-listener", () => undefined);
    auth.setState({ status: "unauthenticated" });
    equal(listeners.count(), 0);
    coordinator.dispose();
});

check("account switch unsubscribes old account", () => {
    const h = createHarness(driver => new CustomerRepository(driver), customerSyncCodec);
    activate(h.mode);
    const listeners = new ListenerCoordinator();
    const auth = new FakeAuthStateSource();
    const coordinator = coordinatorFor(h, new FakeRealtimeStore(), auth, listeners);
    coordinator.start();
    listeners.register("old-account-listener", () => undefined);
    auth.setState(authenticatedState(accountB));
    equal(listeners.count(), 0);
    coordinator.dispose();
});

check("pre-existing records are not scanned or uploaded", () => {
    const h = createHarness(driver => new SupplierRepository(driver), supplierSyncCodec);
    h.cache.addToAccount(accountA, supplier("existing-supplier"));
    const store = new FakeRealtimeStore();
    equal(h.outbox.allForAccount(accountA).length, 0);
    equal(store.writeCount, 0);
    equal(store.listenerCount, 0);
});

check("disabled startup has zero operational writes and listeners", () => {
    const store = new FakeRealtimeStore();
    const listeners = new ListenerCoordinator();
    equal(store.writeCount, 0);
    equal(store.listenerCount, 0);
    equal(listeners.count(), 0);
});

check("transport refuses every project except approved TEST", async () => {
    const h = createHarness(driver => new CustomerRepository(driver), customerSyncCodec);
    activate(h.mode);
    h.bridge.addToAccount(accountA, customer());
    await rejects(() => new MasterDataSyncOperationTransport(
        new FakeRealtimeStore(),
        () => "not-the-approved-test-project"
    ).execute(operationFor(h)));
});

check("three and only three operational appliers register", () => {
    const driver = new MemoryDriver();
    const state = new MasterDataSyncStateRepository(driver);
    const registry = new LocalMutationApplierRegistry();
    registry.register(new MasterDataLocalMutationApplier(new ProductRepository(driver), state, productSyncCodec));
    registry.register(new MasterDataLocalMutationApplier(new CustomerRepository(driver), state, customerSyncCodec));
    registry.register(new MasterDataLocalMutationApplier(new SupplierRepository(driver), state, supplierSyncCodec));
    equal(registry.count(), 3);
});

function coordinatorFor<T extends object>(
    h: ModuleHarness<T>,
    store: FakeRealtimeStore,
    auth: FakeAuthStateSource,
    listeners: ListenerCoordinator
): SyncCoordinator {
    const registry = new LocalMutationApplierRegistry();
    registry.register(h.applier);
    const coordinator = new SyncCoordinator(
        h.mode,
        h.outbox,
        new SyncReceiptRepository(h.driver),
        new SyncConflictRepository(h.driver),
        new RetryPolicy(),
        listeners,
        new SyncStatusService(),
        new MasterDataSyncOperationTransport(store, () => "abonibal-erp-test"),
        auth,
        () => now
    );
    coordinator.configureLocalMutationReconciler(
        new LocalMutationReconciler(h.outbox, registry, h.capture)
    );
    return coordinator;
}

function resolveTimestamp(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(resolveTimestamp);
    if (value && typeof value === "object") {
        const candidate = value as Record<string, unknown>;
        if (candidate[".sv"] === "timestamp") return 1_720_000_000_000;
        return Object.fromEntries(Object.entries(candidate).map(([key, child]) => [key, resolveTimestamp(child)]));
    }
    return value;
}

function equal(actual: unknown, expected: unknown): void {
    if (!Object.is(actual, expected)) {
        throw new Error(`Expected ${String(expected)}, received ${String(actual)}.`);
    }
}

function throws(action: () => unknown): void {
    let didThrow = false;
    try { action(); } catch { didThrow = true; }
    if (!didThrow) throw new Error("Expected action to throw.");
}

async function rejects(action: () => Promise<unknown>): Promise<void> {
    let didReject = false;
    try { await action(); } catch { didReject = true; }
    if (!didReject) throw new Error("Expected action to reject.");
}

let passed = 0;
for (const item of checks) {
    try {
        await item.run();
        passed += 1;
        console.log(`PASS ${passed}: ${item.name}`);
    } catch (error) {
        console.error(`FAIL: ${item.name}`);
        throw error;
    }
}

console.log(`V1-SYNC-005 master-data smoke: PASS (${passed}/${checks.length})`);
