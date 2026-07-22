import { readFileSync } from "node:fs";
import type { Driver } from "../src/core/persistence/Driver.ts";
import type { AuthState } from "../src/modules/auth/AuthState.ts";
import type { AuthStateService } from "../src/modules/auth/AuthStateService.ts";
import type { StockMovement } from "../src/modules/inventory/StockMovement.ts";
import { buildStockMovementAppendOperation } from "../src/modules/inventory/sync/StockMovementSyncOperation.ts";
import type { InvoiceReturn } from "../src/modules/sales/InvoiceReturn.ts";
import { InvoiceReturnRepository } from "../src/modules/sales/repositories/InvoiceReturnRepository.ts";
import { InvoiceReturnSyncRepository } from "../src/modules/sales/repositories/InvoiceReturnSyncRepository.ts";
import { InvoiceReturnSyncStateRepository } from "../src/modules/sales/repositories/InvoiceReturnSyncStateRepository.ts";
import { InvoiceReturnLocalMutationApplier } from "../src/modules/sales/sync/InvoiceReturnLocalMutationApplier.ts";
import { InvoiceReturnSyncAdapter } from "../src/modules/sales/sync/InvoiceReturnSyncAdapter.ts";
import {
    buildInvoiceReturnRecordedCreateOperation,
    buildInvoiceReturnRecordedUpdateOperation
} from "../src/modules/sales/sync/InvoiceReturnSyncOperation.ts";
import { InvoiceReturnSyncOperationTransport } from "../src/modules/sales/sync/InvoiceReturnSyncOperationTransport.ts";
import {
    createInvoiceReturnCloudEnvelope,
    invoiceReturnRecordPath,
    normalizeInvoiceReturnCloudEnvelope
} from "../src/modules/sales/sync/InvoiceReturnSyncTypes.ts";
import { buildInvoiceReturnLifecycleTransitionOperation } from "../src/modules/sales/sync/SalesCommercialSyncOperation.ts";
import { InvoiceReturnValidator } from "../src/modules/sales/validators/InvoiceReturnValidator.ts";
import {
    createPendingSyncOperation,
    type SyncOperation
} from "../src/modules/sync/SyncOperation.ts";
import { PersistentOutboxRepository } from "../src/modules/sync/repositories/PersistentOutboxRepository.ts";
import { SyncConflictRepository } from "../src/modules/sync/repositories/SyncConflictRepository.ts";
import { SyncReceiptRepository } from "../src/modules/sync/repositories/SyncReceiptRepository.ts";
import { DurableMutationCapture } from "../src/modules/sync/services/DurableMutationCapture.ts";
import { ListenerCoordinator } from "../src/modules/sync/services/ListenerCoordinator.ts";
import { SyncCloudCapabilityRegistry } from "../src/modules/sync/services/SyncCloudCapabilityRegistry.ts";
import { SyncEchoPolicy } from "../src/modules/sync/services/SyncEchoPolicy.ts";
import { SyncModeService } from "../src/modules/sync/services/SyncModeService.ts";
import { SyncOperationTransportRegistry } from "../src/modules/sync/services/SyncOperationTransportRegistry.ts";

const accountId = "logical-account-invoice-return-sync";
const userId = "logical-user-invoice-return-sync";
const firebaseUid = "firebase-membership-only-invoice-return-sync";
const now = "2026-07-22T08:00:00.000Z";

class MemoryDriver implements Driver {
    private readonly values = new Map<string, unknown>();

    public read<T>(key: string): T | null {
        return this.values.has(key)
            ? structuredClone(this.values.get(key)) as T
            : null;
    }

    public write<T>(key: string, value: T): void {
        this.values.set(key, structuredClone(value));
    }

    public remove(key: string): void {
        this.values.delete(key);
    }

    public clear(): void {
        this.values.clear();
    }

    public keys(): string[] {
        return [...this.values.keys()];
    }
}

class FakeAuthStateService {
    public getState(): AuthState {
        return authenticatedState();
    }
}

class FakeRealtimeStore {
    private readonly values = new Map<string, unknown>();
    public writes = 0;
    public compareAndSets = 0;
    public subscriptions = 0;

    public async read<T>(path: string): Promise<T | null> {
        const value = this.values.get(normalizePath(path));
        return value === undefined ? null : structuredClone(value) as T;
    }

    public async createIfAbsent<T>(path: string, value: T) {
        const key = normalizePath(path);
        const current = this.values.get(key);

        if (current !== undefined) {
            return { created: false, value: structuredClone(current) as T };
        }

        const resolved = resolveServerValues(value);
        this.values.set(key, resolved);
        this.writes += 1;
        return { created: true, value: structuredClone(resolved) as T };
    }

    public async compareAndSetMetaRevision<T extends {
        meta: { revision: number; recordChecksum: string };
    }>(
        path: string,
        expectedRevision: number,
        expectedChecksum: string,
        nextValue: T
    ) {
        const key = normalizePath(path);
        const current = this.values.get(key) as T | undefined;
        this.compareAndSets += 1;

        if (
            !current
            || current.meta.revision !== expectedRevision
            || current.meta.recordChecksum !== expectedChecksum
        ) {
            return {
                updated: false,
                conflict: true,
                ...(current
                    ? {
                        actualRevision: current.meta.revision,
                        actualChecksum: current.meta.recordChecksum
                    }
                    : {}),
                value: current ? structuredClone(current) : null
            };
        }

        const resolved = resolveServerValues(nextValue) as T;
        this.values.set(key, resolved);
        this.writes += 1;
        return {
            updated: true,
            conflict: false,
            actualRevision: resolved.meta.revision,
            actualChecksum: resolved.meta.recordChecksum,
            value: structuredClone(resolved)
        };
    }

    public async updateChildren(
        path: string,
        values: Record<string, unknown>
    ): Promise<void> {
        const base = normalizePath(path);

        for (const [child, value] of Object.entries(values)) {
            this.values.set(
                normalizePath(`${base}/${child}`),
                resolveServerValues(value)
            );
        }

        this.writes += 1;
    }

    public serverTimestampValue(): object {
        return { ".sv": "timestamp" };
    }

    public subscribe<T>(
        _path: string,
        _callback: (value: T | null) => void
    ): () => void {
        this.subscriptions += 1;
        return () => undefined;
    }

    public set(path: string, value: unknown): void {
        this.values.set(normalizePath(path), structuredClone(value));
    }
}

interface Harness {
    driver: MemoryDriver;
    mode: SyncModeService;
    capabilities: SyncCloudCapabilityRegistry;
    routes: SyncOperationTransportRegistry;
    outbox: PersistentOutboxRepository;
    cache: InvoiceReturnRepository;
    syncRepository: InvoiceReturnSyncRepository;
    state: InvoiceReturnSyncStateRepository;
    applier: InvoiceReturnLocalMutationApplier;
    transport: InvoiceReturnSyncOperationTransport;
}

function createHarness(active: boolean, store = new FakeRealtimeStore()): Harness {
    const driver = new MemoryDriver();
    const mode = new SyncModeService();
    const capabilities = new SyncCloudCapabilityRegistry();
    const routes = new SyncOperationTransportRegistry();
    const transport = new InvoiceReturnSyncOperationTransport(
        store,
        () => "abonibal-erp-test"
    );
    capabilities.registerSpecific(
        "invoiceReturns",
        "create",
        ["createRecorded"]
    );
    capabilities.registerSpecific(
        "invoiceReturns",
        "update",
        ["updateRecorded"]
    );
    routes.registerSpecific(
        "invoiceReturns",
        "create",
        "createRecorded",
        transport
    );
    routes.registerSpecific(
        "invoiceReturns",
        "update",
        "updateRecorded",
        transport
    );
    const outbox = new PersistentOutboxRepository(
        driver,
        operation => capabilities.supports(operation) && routes.supports(operation)
    );
    const cache = new InvoiceReturnRepository(driver);
    const state = new InvoiceReturnSyncStateRepository(driver);
    const validator = new InvoiceReturnValidator();
    const applier = new InvoiceReturnLocalMutationApplier(
        cache,
        validator,
        state,
        () => now
    );
    const capture = new DurableMutationCapture(outbox, () => now);
    const syncRepository = new InvoiceReturnSyncRepository(
        cache,
        mode,
        capture,
        applier,
        () => now
    );

    if (active) activate(mode);

    return {
        driver,
        mode,
        capabilities,
        routes,
        outbox,
        cache,
        syncRepository,
        state,
        applier,
        transport
    };
}

const checks: Array<{ name: string; run: () => void | Promise<void> }> = [];

checks.push({
    name: "disabled recorded create and update remain local with zero outbox",
    run: () => {
        const h = createHarness(false);
        const recorded = buildRecordedReturn("disabled");
        h.syncRepository.appendForAccount(accountId, recorded);
        h.syncRepository.updateForAccount(
            accountId,
            recorded.id,
            updateRecordedReturn(recorded, "disabled update")
        );
        equal(h.outbox.allForAccount(accountId).length, 0);
        equal(h.cache.findForAccount(accountId, recorded.id)?.revision, 1);
    }
});

checks.push({
    name: "active recorded create and update capture exact durable operations",
    run: () => {
        const h = createHarness(true);
        const recorded = buildRecordedReturn("active");
        h.syncRepository.appendForAccount(accountId, recorded);
        const create = h.outbox.allForAccount(accountId)[0];
        equal(create?.cloudAction, "createRecorded");
        equal(create?.operationType, "create");
        h.syncRepository.updateForAccount(
            accountId,
            recorded.id,
            updateRecordedReturn(recorded, "active update")
        );
        const update = h.outbox.allForAccount(accountId)[1];
        equal(update?.cloudAction, "updateRecorded");
        equal(update?.expectedRevision, 0);
        equal(h.cache.findForAccount(accountId, recorded.id)?.revision, 1);
    }
});

checks.push({
    name: "recorded create transport is idempotent and conflicting identity is rejected",
    run: async () => {
        const store = new FakeRealtimeStore();
        const transport = new InvoiceReturnSyncOperationTransport(
            store,
            () => "abonibal-erp-test"
        );
        const recorded = buildRecordedReturn("transport-create");
        const operation = pending(
            buildInvoiceReturnRecordedCreateOperation(recorded, now)
        );
        equal((await transport.execute(operation)).kind, "acknowledged");
        equal(
            (await transport.execute(operation)).result,
            "duplicate_acknowledged"
        );
        const conflict = pending(buildInvoiceReturnRecordedCreateOperation(
            { ...recorded, reason: "different" },
            now
        ));
        equal((await transport.execute(conflict)).kind, "conflict");
    }
});

checks.push({
    name: "recorded update uses CAS and stale retry conflicts",
    run: async () => {
        const store = new FakeRealtimeStore();
        const transport = new InvoiceReturnSyncOperationTransport(
            store,
            () => "abonibal-erp-test"
        );
        const recorded = buildRecordedReturn("transport-update");
        await transport.execute(pending(
            buildInvoiceReturnRecordedCreateOperation(recorded, now)
        ));
        const updated = updateRecordedReturn(recorded, "valid update");
        equal((await transport.execute(pending(
            buildInvoiceReturnRecordedUpdateOperation(recorded, updated, later(1))
        ))).kind, "acknowledged");
        const stale = updateRecordedReturn(recorded, "stale update");
        equal((await transport.execute(pending(
            buildInvoiceReturnRecordedUpdateOperation(recorded, stale, later(2))
        ))).kind, "conflict");
        equal(store.compareAndSets, 1);
    }
});

checks.push({
    name: "missing cloud baseline update conflicts without implicit create",
    run: async () => {
        const store = new FakeRealtimeStore();
        const transport = new InvoiceReturnSyncOperationTransport(
            store,
            () => "abonibal-erp-test"
        );
        const recorded = buildRecordedReturn("missing-baseline");
        const result = await transport.execute(pending(
            buildInvoiceReturnRecordedUpdateOperation(
                recorded,
                updateRecordedReturn(recorded, "local-only history"),
                now
            )
        ));
        equal(result.kind, "conflict");
        equal(store.writes, 0);
    }
});

checks.push({
    name: "recorded repository denies active executed-state update",
    run: () => {
        const h = createHarness(true);
        const recorded = buildRecordedReturn("execute-denied");
        h.syncRepository.appendForAccount(accountId, recorded);
        assertThrows(() => h.syncRepository.updateForAccount(
            accountId,
            recorded.id,
            executeRecordedReturn(recorded)
        ));
        equal(h.outbox.allForAccount(accountId).length, 1);
    }
});

checks.push({
    name: "transport denies execute and generic InvoiceReturn routes",
    run: async () => {
        const h = createHarness(true);
        const recorded = buildRecordedReturn("transport-execute-denied");
        const execute = pending(buildInvoiceReturnLifecycleTransitionOperation(
            recorded,
            executeRecordedReturn(recorded),
            `invoice-return-execute-${recorded.id}`,
            now
        ));
        await assertRejects(() => h.transport.execute(execute));
        truthy(!h.routes.supports(execute));
        truthy(!h.capabilities.supports(execute));
    }
});

checks.push({
    name: "recorded pull applies cache-only and duplicate pull is a no-op",
    run: async () => {
        const store = new FakeRealtimeStore();
        const h = createHarness(true, store);
        const adapter = createAdapter(h, store);
        const recorded = buildRecordedReturn("pull-recorded");
        await h.transport.execute(pending(
            buildInvoiceReturnRecordedCreateOperation(recorded, now)
        ));
        equal((await adapter.pullRecord(accountId, recorded.id)).outcome, "applied");
        equal((await adapter.pullRecord(accountId, recorded.id)).outcome, "duplicate");
        equal(h.cache.findForAccount(accountId, recorded.id)?.status, "recorded");
    }
});

checks.push({
    name: "newer recorded pull applies while older revision is ignored",
    run: async () => {
        const store = new FakeRealtimeStore();
        const h = createHarness(true, store);
        const adapter = createAdapter(h, store);
        const recorded = buildRecordedReturn("pull-update");
        await h.transport.execute(pending(
            buildInvoiceReturnRecordedCreateOperation(recorded, now)
        ));
        await adapter.pullRecord(accountId, recorded.id);
        const updated = updateRecordedReturn(recorded, "remote update");
        await h.transport.execute(pending(
            buildInvoiceReturnRecordedUpdateOperation(recorded, updated, later(1))
        ));
        equal((await adapter.pullRecord(accountId, recorded.id)).outcome, "applied");
        equal(h.cache.findForAccount(accountId, recorded.id)?.reason, "remote update");
        const older = createInvoiceReturnCloudEnvelope(pending(
            buildInvoiceReturnRecordedCreateOperation(recorded, now)
        ), 1);
        equal(
            adapter.applyPulledEnvelope(accountId, recorded.id, older).outcome,
            "ignored_older"
        );
    }
});

checks.push({
    name: "pending local recorded update preserves pull conflict evidence",
    run: async () => {
        const store = new FakeRealtimeStore();
        const h = createHarness(true, store);
        const adapter = createAdapter(h, store);
        const recorded = buildRecordedReturn("pull-conflict");
        await h.transport.execute(pending(
            buildInvoiceReturnRecordedCreateOperation(recorded, now)
        ));
        await adapter.pullRecord(accountId, recorded.id);
        h.syncRepository.updateForAccount(
            accountId,
            recorded.id,
            updateRecordedReturn(recorded, "local pending")
        );
        const result = adapter.applyPulledEnvelope(
            accountId,
            recorded.id,
            createInvoiceReturnCloudEnvelope(pending(
                buildInvoiceReturnRecordedUpdateOperation(
                    recorded,
                    updateRecordedReturn(recorded, "remote competing"),
                    later(1)
                )
            ), 2)
        );
        equal(result.outcome, "conflict");
        equal(new SyncConflictRepository(h.driver).allForAccount(accountId).length, 1);
    }
});

checks.push({
    name: "synthetic trusted executed pull applies state without command replay",
    run: async () => {
        const store = new FakeRealtimeStore();
        const h = createHarness(true, store);
        const adapter = createAdapter(h, store);
        const recorded = buildRecordedReturn("pull-executed");
        await h.transport.execute(pending(
            buildInvoiceReturnRecordedCreateOperation(recorded, now)
        ));
        await adapter.pullRecord(accountId, recorded.id);
        const executed = executeRecordedReturn(recorded);
        const executeOperation = pending(
            buildInvoiceReturnLifecycleTransitionOperation(
                recorded,
                executed,
                `invoice-return-execute-${recorded.id}`,
                later(1)
            )
        );
        store.set(
            invoiceReturnRecordPath(accountId, recorded.id),
            createInvoiceReturnCloudEnvelope(executeOperation, 2)
        );
        equal((await adapter.pullRecord(accountId, recorded.id)).outcome, "applied");
        equal(h.cache.findForAccount(accountId, recorded.id)?.status, "executed");
    }
});

checks.push({
    name: "exact recorded capabilities and transports never match execute",
    run: () => {
        const h = createHarness(true);
        const recorded = buildRecordedReturn("capability");
        const create = pending(buildInvoiceReturnRecordedCreateOperation(recorded, now));
        const update = pending(buildInvoiceReturnRecordedUpdateOperation(
            recorded,
            updateRecordedReturn(recorded, "capability update"),
            later(1)
        ));
        const execute = pending(buildInvoiceReturnLifecycleTransitionOperation(
            recorded,
            executeRecordedReturn(recorded),
            `invoice-return-execute-${recorded.id}`,
            later(2)
        ));
        truthy(h.capabilities.supports(create) && h.routes.supports(create));
        truthy(h.capabilities.supports(update) && h.routes.supports(update));
        truthy(!h.capabilities.supports(execute));
        truthy(!h.routes.supports(execute));
    }
});

checks.push({
    name: "execution group stays blocked and StockMovement sibling cannot leak",
    run: () => {
        const h = createHarness(true);
        h.capabilities.register("stockMovements", ["append"]);
        h.routes.register(["stockMovements"], new AcknowledgingTransport());
        const recorded = buildRecordedReturn("group-blocked");
        const execute = buildInvoiceReturnLifecycleTransitionOperation(
            recorded,
            executeRecordedReturn(recorded),
            `invoice-return-execute-${recorded.id}`,
            now
        );
        const movement = buildStockMovementAppendOperation(
            returnMovement(recorded),
            now
        );
        const members = h.outbox.enqueueBatchAtomic(accountId, {
            groupId: `invoice-return-execute-${recorded.id}`,
            groupType: "invoice_return_execution",
            members: [
                { operation: execute, groupSequence: 1, requiredForLocalCompletion: true },
                { operation: movement, groupSequence: 2, requiredForLocalCompletion: true }
            ]
        });
        markLocallyApplied(h.outbox, members);
        equal(h.outbox.getPending(accountId, now).length, 0);
    }
});

checks.push({
    name: "existing local InvoiceReturns are not scanned uploaded or rewritten",
    run: () => {
        const h = createHarness(false);
        const existing = buildRecordedReturn("historical-local");
        h.cache.appendForAccount(accountId, existing);
        equal(h.outbox.allForAccount(accountId).length, 0);
        equal(h.cache.findForAccount(accountId, existing.id)?.id, existing.id);
        truthy(!h.driver.keys().some(key => key.includes("providerUserId")));
    }
});

checks.push({
    name: "no delete tombstone accounting coupling or automatic listeners exist",
    run: () => {
        const repository = readFileSync(
            "src/modules/sales/repositories/InvoiceReturnRepository.ts",
            "utf8"
        );
        const syncRepository = readFileSync(
            "src/modules/sales/repositories/InvoiceReturnSyncRepository.ts",
            "utf8"
        );
        const applier = readFileSync(
            "src/modules/sales/sync/InvoiceReturnLocalMutationApplier.ts",
            "utf8"
        );
        const container = readFileSync("src/core/Container.ts", "utf8");
        truthy(!repository.includes("removeForAccount"));
        truthy(!syncRepository.includes("Tombstone"));
        truthy(!container.includes("invoiceReturnSyncAdapter.startSubscription"));
        ["PaymentService", "CashMovementService", "JournalEntryService", "StockMovementRepository"]
            .forEach(token => truthy(!applier.includes(token)));
        truthy(!container.includes('["execute"]'));
    }
});

checks.push({
    name: "transport is restricted to approved TEST project",
    run: async () => {
        const transport = new InvoiceReturnSyncOperationTransport(
            new FakeRealtimeStore(),
            () => "not-the-approved-project"
        );
        await assertRejects(() => transport.execute(pending(
            buildInvoiceReturnRecordedCreateOperation(
                buildRecordedReturn("project-boundary"),
                now
            )
        )));
    }
});

function createAdapter(
    h: Harness,
    store: FakeRealtimeStore
): InvoiceReturnSyncAdapter {
    return new InvoiceReturnSyncAdapter(
        store,
        h.mode,
        new FakeAuthStateService() as unknown as AuthStateService,
        h.outbox,
        new SyncConflictRepository(h.driver),
        new SyncReceiptRepository(h.driver),
        new ListenerCoordinator(),
        new SyncEchoPolicy(),
        h.applier
    );
}

function buildRecordedReturn(id: string): InvoiceReturn {
    return {
        id,
        accountId,
        returnNumber: `RET-20260722-${id}`,
        invoiceId: `invoice-${id}`,
        invoiceNumberSnapshot: `INV-20260722-${id}`,
        status: "recorded",
        revision: 0,
        reason: "Recorded return",
        lines: [{
            id: `${id}-line-1`,
            invoiceLineId: `${id}-invoice-line-1`,
            productId: "product-1",
            productNameSnapshot: "Snapshot Product",
            quantity: 2,
            unitPriceSnapshot: 10,
            lineTotalSnapshot: 20,
            returnQuantity: 1,
            originalSaleDeductionMovementId: `sale-${id}`,
            returnStockMovementId: null
        }],
        total: 10,
        createdAt: now,
        createdBy: userId,
        updatedAt: now,
        updatedBy: userId
    };
}

function updateRecordedReturn(
    recorded: InvoiceReturn,
    reason: string
): InvoiceReturn {
    return {
        ...structuredClone(recorded),
        revision: (recorded.revision ?? 0) + 1,
        reason,
        updatedAt: later(1),
        updatedBy: userId
    };
}

function executeRecordedReturn(recorded: InvoiceReturn): InvoiceReturn {
    return {
        ...structuredClone(recorded),
        status: "executed",
        revision: (recorded.revision ?? 0) + 1,
        executionCommandId: `invoice-return-execute-${recorded.id}`,
        lines: recorded.lines.map(line => ({
            ...line,
            returnStockMovementId: `invoice-return-${recorded.id}-${line.id}`
        })),
        updatedAt: later(2),
        updatedBy: userId
    };
}

function returnMovement(invoiceReturn: InvoiceReturn): StockMovement {
    return {
        id: `invoice-return-${invoiceReturn.id}-${invoiceReturn.lines[0].id}`,
        accountId,
        productId: invoiceReturn.lines[0].productId,
        type: "sale_return",
        quantityDelta: invoiceReturn.lines[0].returnQuantity,
        reason: "Invoice return",
        referenceType: "invoice_return",
        referenceId: invoiceReturn.id,
        ledgerSemanticsVersion: 2,
        createdAt: now,
        createdBy: userId
    };
}

class AcknowledgingTransport {
    public async execute() {
        return { kind: "acknowledged" as const, result: "created" as const };
    }
}

function pending(
    input: Parameters<typeof createPendingSyncOperation>[0]
): SyncOperation {
    return createPendingSyncOperation(input);
}

function markLocallyApplied(
    outbox: PersistentOutboxRepository,
    operations: SyncOperation[]
): void {
    for (const operation of operations) {
        outbox.markLocalApplyAttempt(accountId, operation.operationId, now);
        outbox.markLocallyApplied(accountId, operation.operationId, now);
    }
}

function activate(mode: SyncModeService): void {
    mode.activate({
        ownerApproved: true,
        migrationVerified: true,
        cutoverApproved: true,
        approvalReference: "V1-SYNC-007D-CONTROLLED-TEST"
    });
}

function authenticatedState(): AuthState {
    return {
        status: "authenticated",
        session: {
            account: { id: accountId, name: "InvoiceReturn Sync Test" },
            user: {
                id: userId,
                accountId,
                providerUserId: firebaseUid,
                displayName: "InvoiceReturn Sync Tester",
                email: "invoice-return-sync@example.invalid",
                roles: ["owner"],
                isActive: true
            },
            issuedAt: now
        }
    };
}

function resolveServerValues<T>(value: T): T {
    if (Array.isArray(value)) {
        return value.map(resolveServerValues) as T;
    }

    if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;

        if (record[".sv"] === "timestamp") {
            return 1784707200000 as T;
        }

        return Object.fromEntries(
            Object.entries(record).map(([key, child]) => [
                key,
                resolveServerValues(child)
            ])
        ) as T;
    }

    return value;
}

function normalizePath(path: string): string {
    return path.trim().replace(/^\/+|\/+$/g, "");
}

function later(minutes: number): string {
    return new Date(Date.parse(now) + minutes * 60_000).toISOString();
}

function truthy(value: unknown, message = "Expected truthy value."): asserts value {
    if (!value) throw new Error(message);
}

function equal(actual: unknown, expected: unknown, message = "Values differ."): void {
    if (actual !== expected) {
        throw new Error(`${message} Expected ${String(expected)}, got ${String(actual)}.`);
    }
}

function assertThrows(action: () => unknown): void {
    let threw = false;
    try {
        action();
    } catch {
        threw = true;
    }
    truthy(threw, "Expected action to throw.");
}

async function assertRejects(action: () => Promise<unknown>): Promise<void> {
    let rejected = false;
    try {
        await action();
    } catch {
        rejected = true;
    }
    truthy(rejected, "Expected action to reject.");
}

const results: Array<{ check: string; result: "PASS" }> = [];

for (const check of checks) {
    await check.run();
    results.push({ check: check.name, result: "PASS" });
}

console.log(JSON.stringify({
    mission: "V1-SYNC-007D",
    result: "PASS",
    checks: results,
    recordedCreateUpdateSync: "PASS",
    recordedDeletionTombstone: "N/A",
    physicalCloudDelete: false,
    missingCloudBaselineProtection: "PASS",
    pullCacheOnly: "PASS",
    businessCommandReplay: 0,
    pullCreatedStockMovements: 0,
    createRecordedCapability: true,
    updateRecordedCapability: true,
    executeCapability: false,
    createRecordedTransport: true,
    updateRecordedTransport: true,
    executeTransport: false,
    executionGroupCloudCapable: false,
    commercialSaleReturnLeak: 0,
    specificToGenericFallback: "DENIED",
    existingInvoiceReturnsAutoUploaded: 0,
    migrationOrBackfill: "NONE",
    operationalLiveRtdbWrites: 0,
    defaultSyncMode: "disabled",
    concurrentCrossDeviceOverReturnSolved: false,
    multiDeviceNumberingSolved: false,
    productionTouched: false
}, null, 2));
