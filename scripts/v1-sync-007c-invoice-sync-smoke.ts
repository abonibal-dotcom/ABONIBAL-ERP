import { readFileSync } from "node:fs";
import type { Driver } from "../src/core/persistence/Driver.ts";
import type { AuthState } from "../src/modules/auth/AuthState.ts";
import type { AuthStateService } from "../src/modules/auth/AuthStateService.ts";
import type { StockMovement } from "../src/modules/inventory/StockMovement.ts";
import { buildStockMovementAppendOperation } from "../src/modules/inventory/sync/StockMovementSyncOperation.ts";
import type { Invoice } from "../src/modules/sales/Invoice.ts";
import type { InvoiceReturn } from "../src/modules/sales/InvoiceReturn.ts";
import { InvoiceRepository } from "../src/modules/sales/repositories/InvoiceRepository.ts";
import { InvoiceSyncRepository } from "../src/modules/sales/repositories/InvoiceSyncRepository.ts";
import { InvoiceSyncStateRepository } from "../src/modules/sales/repositories/InvoiceSyncStateRepository.ts";
import { InvoiceLocalMutationApplier } from "../src/modules/sales/sync/InvoiceLocalMutationApplier.ts";
import { InvoiceSyncAdapter } from "../src/modules/sales/sync/InvoiceSyncAdapter.ts";
import {
    buildInvoiceDraftCreateOperation,
    buildInvoiceDraftTombstoneOperation,
    buildInvoiceDraftUpdateOperation
} from "../src/modules/sales/sync/InvoiceSyncOperation.ts";
import { InvoiceSyncOperationTransport } from "../src/modules/sales/sync/InvoiceSyncOperationTransport.ts";
import {
    createInvoiceCloudEnvelope,
    invoiceRecordPath,
    normalizeInvoiceCloudEnvelope
} from "../src/modules/sales/sync/InvoiceSyncTypes.ts";
import { buildInvoiceLifecycleTransitionOperation } from "../src/modules/sales/sync/SalesCommercialSyncOperation.ts";
import { InvoiceValidator } from "../src/modules/sales/validators/InvoiceValidator.ts";
import { createPendingSyncOperation, type SyncOperation } from "../src/modules/sync/SyncOperation.ts";
import type { SyncOperationGroupBatchInput } from "../src/modules/sync/SyncOperationGroup.ts";
import { PersistentOutboxRepository } from "../src/modules/sync/repositories/PersistentOutboxRepository.ts";
import { SyncConflictRepository } from "../src/modules/sync/repositories/SyncConflictRepository.ts";
import { SyncReceiptRepository } from "../src/modules/sync/repositories/SyncReceiptRepository.ts";
import { DurableMutationCapture } from "../src/modules/sync/services/DurableMutationCapture.ts";
import { ListenerCoordinator } from "../src/modules/sync/services/ListenerCoordinator.ts";
import { SyncCloudCapabilityRegistry } from "../src/modules/sync/services/SyncCloudCapabilityRegistry.ts";
import { SyncEchoPolicy } from "../src/modules/sync/services/SyncEchoPolicy.ts";
import { SyncModeService } from "../src/modules/sync/services/SyncModeService.ts";

const accountId = "logical-account-invoice-sync";
const userId = "logical-user-invoice-sync";
const firebaseUid = "firebase-membership-only-invoice-sync";
const now = "2026-07-21T08:00:00.000Z";

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

    public set(path: string, value: unknown): void {
        this.values.set(normalizePath(path), structuredClone(value));
    }
}

interface Harness {
    driver: MemoryDriver;
    mode: SyncModeService;
    capabilities: SyncCloudCapabilityRegistry;
    outbox: PersistentOutboxRepository;
    cache: InvoiceRepository;
    syncRepository: InvoiceSyncRepository;
    state: InvoiceSyncStateRepository;
    applier: InvoiceLocalMutationApplier;
}

function createHarness(active: boolean): Harness {
    const driver = new MemoryDriver();
    const mode = new SyncModeService();
    const capabilities = new SyncCloudCapabilityRegistry();
    const outbox = new PersistentOutboxRepository(
        driver,
        operation => capabilities.supports(operation)
    );
    const cache = new InvoiceRepository(driver);
    const state = new InvoiceSyncStateRepository(driver);
    const validator = new InvoiceValidator();
    const applier = new InvoiceLocalMutationApplier(
        cache,
        validator,
        state,
        () => now
    );
    const capture = new DurableMutationCapture(outbox, () => now);
    const syncRepository = new InvoiceSyncRepository(
        cache,
        mode,
        capture,
        applier,
        () => userId,
        () => now
    );

    if (active) activate(mode);

    return {
        driver,
        mode,
        capabilities,
        outbox,
        cache,
        syncRepository,
        state,
        applier
    };
}

const checks: Array<{ name: string; run: () => void | Promise<void> }> = [];

checks.push({
    name: "disabled Invoice draft mutations stay local with zero outbox",
    run: () => {
        const h = createHarness(false);
        const draft = buildDraft("disabled-draft");
        h.syncRepository.appendForAccount(accountId, draft);
        h.syncRepository.updateForAccount(
            accountId,
            draft.id,
            updateDraft(draft, 1, "disabled edit")
        );
        equal(h.outbox.allForAccount(accountId).length, 0);
        truthy(h.syncRepository.removeForAccount(accountId, draft.id));
        equal(h.cache.allForAccount(accountId).length, 0);
    }
});

checks.push({
    name: "active draft create update and tombstone capture one durable operation each",
    run: () => {
        const h = createHarness(true);
        const draft = buildDraft("active-draft");
        h.syncRepository.appendForAccount(accountId, draft);
        equal(h.outbox.allForAccount(accountId).length, 1);
        equal(h.cache.findForAccount(accountId, draft.id)?.revision, 0);
        const updated = updateDraft(draft, 1, "active edit");
        h.syncRepository.updateForAccount(accountId, draft.id, updated);
        equal(h.outbox.allForAccount(accountId).length, 2);
        equal(h.cache.findForAccount(accountId, draft.id)?.revision, 1);
        truthy(h.syncRepository.removeForAccount(accountId, draft.id));
        equal(h.outbox.allForAccount(accountId).length, 3);
        equal(h.cache.findForAccount(accountId, draft.id), undefined);
        truthy(h.state.find(accountId, draft.id)?.tombstone);
    }
});

checks.push({
    name: "draft create transport is idempotent and conflicting identity is rejected",
    run: async () => {
        const store = new FakeRealtimeStore();
        const transport = new InvoiceSyncOperationTransport(
            store,
            () => "abonibal-erp-test"
        );
        const draft = buildDraft("transport-create");
        const operation = createPendingSyncOperation(
            buildInvoiceDraftCreateOperation(draft, now)
        );
        equal((await transport.execute(operation)).kind, "acknowledged");
        equal((await transport.execute(operation)).result, "duplicate_acknowledged");
        const conflicting = createPendingSyncOperation(
            buildInvoiceDraftCreateOperation(
                { ...draft, notes: "different" },
                now
            )
        );
        equal((await transport.execute(conflicting)).kind, "conflict");
    }
});

checks.push({
    name: "draft CAS update accepts next revision and rejects stale revision",
    run: async () => {
        const store = new FakeRealtimeStore();
        const transport = new InvoiceSyncOperationTransport(store, () => "abonibal-erp-test");
        const draft = buildDraft("transport-update");
        const create = createPendingSyncOperation(buildInvoiceDraftCreateOperation(draft, now));
        await transport.execute(create);
        const updated = updateDraft(draft, 1, "updated");
        const update = createPendingSyncOperation(
            buildInvoiceDraftUpdateOperation(draft, updated, later(1))
        );
        equal((await transport.execute(update)).kind, "acknowledged");
        const stale = createPendingSyncOperation(
            buildInvoiceDraftUpdateOperation(
                draft,
                updateDraft(draft, 1, "stale different"),
                later(2)
            )
        );
        equal((await transport.execute(stale)).kind, "conflict");
        equal(store.compareAndSets, 1);
    }
});

checks.push({
    name: "draft tombstone preserves cloud record and physical delete remains absent",
    run: async () => {
        const store = new FakeRealtimeStore();
        const transport = new InvoiceSyncOperationTransport(store, () => "abonibal-erp-test");
        const draft = buildDraft("transport-tombstone");
        await transport.execute(createPendingSyncOperation(
            buildInvoiceDraftCreateOperation(draft, now)
        ));
        const tombstone = createPendingSyncOperation(
            buildInvoiceDraftTombstoneOperation(draft, later(1), userId)
        );
        equal((await transport.execute(tombstone)).kind, "acknowledged");
        const cloud = await store.read<unknown>(invoiceRecordPath(accountId, draft.id));
        truthy(cloud);
        truthy(normalizeInvoiceCloudEnvelope(cloud).meta.tombstone);
    }
});

checks.push({
    name: "missing cloud baseline update and lifecycle transition conflict",
    run: async () => {
        const store = new FakeRealtimeStore();
        const transport = new InvoiceSyncOperationTransport(store, () => "abonibal-erp-test");
        const draft = buildDraft("missing-baseline");
        const updated = updateDraft(draft, 1, "local history");
        equal((await transport.execute(createPendingSyncOperation(
            buildInvoiceDraftUpdateOperation(draft, updated, now)
        ))).kind, "conflict");
        const issued = issueInvoice(draft);
        equal((await transport.execute(createPendingSyncOperation(
            buildInvoiceLifecycleTransitionOperation(
                draft,
                issued,
                `invoice-issue-${draft.id}`,
                "issue",
                now
            )
        ))).kind, "conflict");
        equal(store.writes, 0);
    }
});

checks.push({
    name: "issued and cancelled lifecycle transitions use CAS and exact retry",
    run: async () => {
        const store = new FakeRealtimeStore();
        const transport = new InvoiceSyncOperationTransport(store, () => "abonibal-erp-test");
        const draft = buildDraft("lifecycle");
        await transport.execute(createPendingSyncOperation(
            buildInvoiceDraftCreateOperation(draft, now)
        ));
        const issued = issueInvoice(draft);
        const issue = createPendingSyncOperation(
            buildInvoiceLifecycleTransitionOperation(
                draft,
                issued,
                `invoice-issue-${draft.id}`,
                "issue",
                later(1)
            )
        );
        equal((await transport.execute(issue)).kind, "acknowledged");
        equal((await transport.execute(issue)).result, "duplicate_acknowledged");
        const cancelled = cancelInvoice(issued);
        const cancel = createPendingSyncOperation(
            buildInvoiceLifecycleTransitionOperation(
                issued,
                cancelled,
                `invoice-cancel-${draft.id}`,
                "cancel",
                later(2)
            )
        );
        equal((await transport.execute(cancel)).kind, "acknowledged");
        equal((await transport.execute(cancel)).result, "duplicate_acknowledged");
        const cloud = normalizeInvoiceCloudEnvelope(
            await store.read(invoiceRecordPath(accountId, draft.id))
        );
        equal(cloud.meta.lifecycleStatus, "cancelled");
    }
});

checks.push({
    name: "Invoice pull is cache-only for draft issued cancelled and tombstone",
    run: async () => {
        const store = new FakeRealtimeStore();
        const transport = new InvoiceSyncOperationTransport(store, () => "abonibal-erp-test");
        const h = createHarness(true);
        const adapter = new InvoiceSyncAdapter(
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
        const draft = buildDraft("pull-lifecycle");
        await transport.execute(createPendingSyncOperation(
            buildInvoiceDraftCreateOperation(draft, now)
        ));
        equal((await adapter.pullRecord(accountId, draft.id)).outcome, "applied");
        equal((await adapter.pullRecord(accountId, draft.id)).outcome, "duplicate");
        const updated = updateDraft(draft, 1, "remote edit");
        await transport.execute(createPendingSyncOperation(
            buildInvoiceDraftUpdateOperation(draft, updated, later(1))
        ));
        equal((await adapter.pullRecord(accountId, draft.id)).outcome, "applied");
        const issued = issueInvoice(updated);
        await transport.execute(createPendingSyncOperation(
            buildInvoiceLifecycleTransitionOperation(
                updated,
                issued,
                `invoice-issue-${draft.id}`,
                "issue",
                later(2)
            )
        ));
        equal((await adapter.pullRecord(accountId, draft.id)).outcome, "applied");
        const cancelled = cancelInvoice(issued);
        await transport.execute(createPendingSyncOperation(
            buildInvoiceLifecycleTransitionOperation(
                issued,
                cancelled,
                `invoice-cancel-${draft.id}`,
                "cancel",
                later(3)
            )
        ));
        equal((await adapter.pullRecord(accountId, draft.id)).outcome, "applied");
        equal(h.cache.findForAccount(accountId, draft.id)?.status, "cancelled");
        truthy(!h.driver.keys().some(key => key.includes("stockMovements")));

        const tombstoneDraft = buildDraft("pull-tombstone");
        await transport.execute(createPendingSyncOperation(
            buildInvoiceDraftCreateOperation(tombstoneDraft, later(4))
        ));
        await adapter.pullRecord(accountId, tombstoneDraft.id);
        await transport.execute(createPendingSyncOperation(
            buildInvoiceDraftTombstoneOperation(tombstoneDraft, later(5), userId)
        ));
        equal((await adapter.pullRecord(accountId, tombstoneDraft.id)).outcome, "applied");
        equal(h.cache.findForAccount(accountId, tombstoneDraft.id), undefined);
    }
});

checks.push({
    name: "pull preserves conflict evidence for pending local operation and legacy divergence",
    run: () => {
        const h = createHarness(true);
        const adapter = new InvoiceSyncAdapter(
            new FakeRealtimeStore(),
            h.mode,
            new FakeAuthStateService() as unknown as AuthStateService,
            h.outbox,
            new SyncConflictRepository(h.driver),
            new SyncReceiptRepository(h.driver),
            new ListenerCoordinator(),
            new SyncEchoPolicy(),
            h.applier
        );
        const local = buildDraft("pull-conflict");
        h.syncRepository.appendForAccount(accountId, local);
        const remote = createInvoiceCloudEnvelope(createPendingSyncOperation(
            buildInvoiceDraftCreateOperation(
                { ...local, notes: "remote different" },
                now
            )
        ));
        equal(adapter.applyPulledEnvelope(accountId, local.id, remote).outcome, "conflict");
    }
});

checks.push({
    name: "Invoice capability unlocks issue and cancellation groups in strict order",
    run: () => {
        const driver = new MemoryDriver();
        const capabilities = new SyncCloudCapabilityRegistry();
        capabilities.register("stockMovements", ["append"]);
        const outbox = new PersistentOutboxRepository(
            driver,
            operation => capabilities.supports(operation)
        );
        const draft = buildDraft("group-issue");
        const issued = issueInvoice(draft);
        const issueOperation = buildInvoiceLifecycleTransitionOperation(
            draft,
            issued,
            `invoice-issue-${draft.id}`,
            "issue",
            now
        );
        const movementOperation = buildStockMovementAppendOperation(
            saleMovement(draft),
            now
        );
        const members = outbox.enqueueBatchAtomic(accountId, {
            groupId: `invoice-issue-${draft.id}`,
            groupType: "invoice_issue",
            members: [
                { operation: issueOperation, groupSequence: 1, requiredForLocalCompletion: true },
                { operation: movementOperation, groupSequence: 2, requiredForLocalCompletion: true }
            ]
        });
        markLocallyApplied(outbox, members);
        equal(outbox.getPending(accountId, now).length, 0);
        capabilities.register("invoices", ["create", "update"]);
        equal(outbox.getPending(accountId, now)[0]?.module, "invoices");
        acknowledge(outbox, members[0]);
        equal(outbox.getPending(accountId, now)[0]?.module, "stockMovements");

        const cancelled = cancelInvoice(issued);
        const cancellationMembers = outbox.enqueueBatchAtomic(accountId, {
            groupId: `invoice-cancel-${draft.id}`,
            groupType: "invoice_cancellation",
            members: [
                {
                    operation: buildInvoiceLifecycleTransitionOperation(
                        issued,
                        cancelled,
                        `invoice-cancel-${draft.id}`,
                        "cancel",
                        later(1)
                    ),
                    groupSequence: 1,
                    requiredForLocalCompletion: true
                },
                {
                    operation: buildStockMovementAppendOperation(
                        returnMovement(cancelled, "cancel-return"),
                        later(1)
                    ),
                    groupSequence: 2,
                    requiredForLocalCompletion: true
                }
            ]
        });
        markLocallyApplied(outbox, cancellationMembers);
        truthy(outbox.getPending(accountId, later(1)).some(
            operation => operation.group?.groupId === `invoice-cancel-${draft.id}`
                && operation.module === "invoices"
        ));
    }
});

checks.push({
    name: "issue acknowledgement survives restart and resumes only the pending movement",
    run: () => {
        const driver = new MemoryDriver();
        const capabilities = new SyncCloudCapabilityRegistry();
        capabilities.register("invoices", ["create", "update"]);
        capabilities.register("stockMovements", ["append"]);
        const outbox = new PersistentOutboxRepository(
            driver,
            operation => capabilities.supports(operation)
        );
        const draft = buildDraft("issue-partial-ack");
        const issued = issueInvoice(draft);
        const members = outbox.enqueueBatchAtomic(accountId, {
            groupId: `invoice-issue-${draft.id}`,
            groupType: "invoice_issue",
            members: [
                {
                    operation: buildInvoiceLifecycleTransitionOperation(
                        draft,
                        issued,
                        `invoice-issue-${draft.id}`,
                        "issue",
                        now
                    ),
                    groupSequence: 1,
                    requiredForLocalCompletion: true
                },
                {
                    operation: buildStockMovementAppendOperation(
                        saleMovement(draft),
                        now
                    ),
                    groupSequence: 2,
                    requiredForLocalCompletion: true
                }
            ]
        });
        markLocallyApplied(outbox, members);
        equal(outbox.getPending(accountId, now)[0]?.module, "invoices");
        acknowledge(outbox, members[0]);

        const restarted = new PersistentOutboxRepository(
            driver,
            operation => capabilities.supports(operation)
        );
        const pending = restarted.getPending(accountId, now);
        equal(pending.length, 1);
        equal(pending[0]?.module, "stockMovements");
        equal(pending[0]?.operationId, members[1]?.operationId);
        truthy(!pending.some(operation => operation.module === "invoices"));
    }
});

checks.push({
    name: "cancellation acknowledgement survives restart and resumes only the pending return movement",
    run: () => {
        const driver = new MemoryDriver();
        const capabilities = new SyncCloudCapabilityRegistry();
        capabilities.register("invoices", ["create", "update"]);
        capabilities.register("stockMovements", ["append"]);
        const outbox = new PersistentOutboxRepository(
            driver,
            operation => capabilities.supports(operation)
        );
        const draft = buildDraft("cancel-partial-ack");
        const issued = issueInvoice(draft);
        const cancelled = cancelInvoice(issued);
        const members = outbox.enqueueBatchAtomic(accountId, {
            groupId: `invoice-cancel-${draft.id}`,
            groupType: "invoice_cancellation",
            members: [
                {
                    operation: buildInvoiceLifecycleTransitionOperation(
                        issued,
                        cancelled,
                        `invoice-cancel-${draft.id}`,
                        "cancel",
                        now
                    ),
                    groupSequence: 1,
                    requiredForLocalCompletion: true
                },
                {
                    operation: buildStockMovementAppendOperation(
                        returnMovement(cancelled, "cancel-partial-return"),
                        now
                    ),
                    groupSequence: 2,
                    requiredForLocalCompletion: true
                }
            ]
        });
        markLocallyApplied(outbox, members);
        acknowledge(outbox, members[0]);

        const restarted = new PersistentOutboxRepository(
            driver,
            operation => capabilities.supports(operation)
        );
        const pending = restarted.getPending(accountId, now);
        equal(pending.length, 1);
        equal(pending[0]?.module, "stockMovements");
        equal(pending[0]?.operationId, members[1]?.operationId);
        truthy(!pending.some(operation => operation.module === "invoices"));
    }
});

checks.push({
    name: "InvoiceReturn group remains blocked and cannot leak StockMovement",
    run: () => {
        const driver = new MemoryDriver();
        const capabilities = new SyncCloudCapabilityRegistry();
        capabilities.register("invoices", ["create", "update"]);
        capabilities.register("stockMovements", ["append"]);
        const outbox = new PersistentOutboxRepository(
            driver,
            operation => capabilities.supports(operation)
        );
        const invoiceReturn = buildReturn("blocked-return");
        const executed = { ...invoiceReturn, status: "executed" as const, revision: 1 };
        const returnOperation = createPendingSyncOperation({
            operationId: "invoice-return-operation",
            accountId,
            module: "invoiceReturns",
            recordId: invoiceReturn.id,
            operationType: "update",
            expectedRevision: 0,
            idempotencyKey: `invoice-return-execute-${invoiceReturn.id}`,
            writeSetChecksum: "return-checksum",
            safePayload: { expected: invoiceReturn, intended: executed },
            createdAt: now
        });
        const movement = buildStockMovementAppendOperation(
            returnMovement(buildDraft("return-source"), "return-movement"),
            now
        );
        const members = outbox.enqueueBatchAtomic(accountId, {
            groupId: `invoice-return-execute-${invoiceReturn.id}`,
            groupType: "invoice_return_execution",
            members: [
                { operation: returnOperation, groupSequence: 1, requiredForLocalCompletion: true },
                { operation: movement, groupSequence: 2, requiredForLocalCompletion: true }
            ]
        });
        markLocallyApplied(outbox, members);
        equal(outbox.getPending(accountId, now).length, 0);
    }
});

checks.push({
    name: "default mode has no startup scan upload listener or UID account fallback",
    run: () => {
        equal(new SyncModeService().getMode(), "disabled");
        const container = readFileSync("src/core/Container.ts", "utf8");
        const repository = readFileSync(
            "src/modules/sales/repositories/InvoiceSyncRepository.ts",
            "utf8"
        );
        const adapter = readFileSync(
            "src/modules/sales/sync/InvoiceSyncAdapter.ts",
            "utf8"
        );
        truthy(!container.includes("invoiceSyncAdapter.startSubscription"));
        truthy(!repository.includes("allForAccount(accountId).forEach"));
        truthy(!adapter.includes("providerUserId"));
        truthy(container.includes("invoiceReturnSyncOperationTransport"));
        truthy(container.includes('"createRecorded"'));
        truthy(container.includes('"updateRecorded"'));
        truthy(!container.includes('["execute"]'));
        truthy(!container.includes("invoiceReturnSyncAdapter.startSubscription"));
    }
});

function buildDraft(id: string): Invoice {
    return {
        id,
        accountId,
        invoiceNumber: `INV-20260721-${id}`,
        status: "draft",
        revision: 0,
        customerSnapshot: { displayName: "Snapshot Customer" },
        lines: [{
            id: `${id}-line-1`,
            productId: "product-1",
            productNameSnapshot: "Snapshot Product",
            quantity: 2,
            unitPrice: 10,
            discount: 0,
            tax: 0,
            lineSubtotal: 20,
            lineTotal: 20,
            stockMovementId: null,
            reversalStockMovementId: null
        }],
        subtotal: 20,
        discount: 0,
        tax: 0,
        total: 20,
        createdAt: now,
        createdBy: userId,
        updatedAt: now,
        updatedBy: userId
    };
}

function updateDraft(
    draft: Invoice,
    revision: number,
    notes: string
): Invoice {
    return {
        ...structuredClone(draft),
        revision,
        notes,
        updatedAt: later(revision),
        updatedBy: userId
    };
}

function issueInvoice(draft: Invoice): Invoice {
    return {
        ...structuredClone(draft),
        status: "issued",
        revision: (draft.revision ?? 0) + 1,
        issueCommandId: `invoice-issue-${draft.id}`,
        issuedAt: later(10),
        issuedBy: userId,
        updatedAt: later(10),
        lines: draft.lines.map(line => ({
            ...line,
            stockMovementId: `sale-${draft.id}-${line.id}`
        }))
    };
}

function cancelInvoice(issued: Invoice): Invoice {
    return {
        ...structuredClone(issued),
        status: "cancelled",
        revision: (issued.revision ?? 0) + 1,
        cancellationCommandId: `invoice-cancel-${issued.id}`,
        cancelledAt: later(20),
        cancelledBy: userId,
        cancelReason: "Test cancellation",
        updatedAt: later(20),
        lines: issued.lines.map(line => ({
            ...line,
            reversalStockMovementId: `invoice-cancel-return-${issued.id}-${line.id}`
        }))
    };
}

function saleMovement(invoice: Invoice): StockMovement {
    return {
        id: `sale-${invoice.id}-${invoice.lines[0].id}`,
        accountId,
        productId: invoice.lines[0].productId,
        type: "sale_deduction",
        quantityDelta: -invoice.lines[0].quantity,
        reason: "Invoice sale",
        referenceType: "invoice",
        referenceId: invoice.id,
        metadata: { invoiceId: invoice.id },
        ledgerSemanticsVersion: 2,
        createdAt: now,
        createdBy: userId
    };
}

function returnMovement(invoice: Invoice, id: string): StockMovement {
    return {
        ...saleMovement(invoice),
        id,
        type: "sale_return",
        quantityDelta: invoice.lines[0].quantity,
        referenceType: "invoice_return"
    };
}

function buildReturn(id: string): InvoiceReturn {
    return {
        id,
        accountId,
        returnNumber: `RET-20260721-${id}`,
        invoiceId: "invoice-source",
        invoiceNumber: "INV-source",
        status: "recorded",
        revision: 0,
        customerSnapshot: null,
        lines: [{
            id: `${id}-line-1`,
            invoiceLineId: "invoice-line-1",
            productId: "product-1",
            productNameSnapshot: "Snapshot Product",
            quantity: 1,
            unitPriceSnapshot: 10,
            lineTotalSnapshot: 10,
            returnStockMovementId: null
        }],
        total: 10,
        createdAt: now,
        createdBy: userId,
        updatedAt: now,
        updatedBy: userId
    };
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

function acknowledge(
    outbox: PersistentOutboxRepository,
    operation: SyncOperation
): void {
    outbox.markSyncing(accountId, operation.operationId, now);
    outbox.markAcknowledged(accountId, operation.operationId);
}

function activate(mode: SyncModeService): void {
    mode.activate({
        ownerApproved: true,
        migrationVerified: true,
        cutoverApproved: true,
        approvalReference: "V1-SYNC-007C-CONTROLLED-TEST"
    });
}

function authenticatedState(): AuthState {
    return {
        status: "authenticated",
        session: {
            account: { id: accountId, name: "Invoice Sync Test Account" },
            user: {
                id: userId,
                accountId,
                providerUserId: firebaseUid,
                displayName: "Invoice Sync Tester",
                email: "invoice-sync@example.invalid",
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
            return 1784620800000 as T;
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

const results: Array<{ check: string; result: "PASS" }> = [];

for (const check of checks) {
    await check.run();
    results.push({ check: check.name, result: "PASS" });
}

console.log(JSON.stringify({
    mission: "V1-SYNC-007C",
    result: "PASS",
    checks: results,
    invoiceSyncTests: "PASS",
    draftCas: "PASS",
    draftTombstone: "PASS",
    missingCloudBaseline: "PASS",
    pullCacheOnly: "PASS",
    businessCommandReplay: 0,
    invoicePullCreatedStockMovements: 0,
    issueCapabilityTransition: "PASS",
    cancellationCapabilityTransition: "PASS",
    invoiceReturnGroupBlocked: "PASS",
    commercialMovementLeak: 0,
    groupOrdering: "PASS",
    issuePartialAcknowledgementRecovery: "PASS",
    cancellationPartialAcknowledgementRecovery: "PASS",
    existingInvoicesAutoUploaded: 0,
    migrationOrBackfill: "NONE",
    operationalLiveRtdbWrites: 0,
    multiDeviceNumberingSolved: false,
    concurrentOverReturnSolved: false,
    defaultSyncMode: "disabled",
    productionTouched: false
}, null, 2));
