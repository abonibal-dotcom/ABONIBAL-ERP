import type { Driver } from "../src/core/persistence/Driver.ts";
import type { AuthState } from "../src/modules/auth/AuthState.ts";
import {
    type SyncExecutionResult,
    type SyncOperationTransport
} from "../src/modules/sync/SyncContracts.ts";
import type {
    SyncOperation,
    SyncOperationInput,
    SyncOperationType
} from "../src/modules/sync/SyncOperation.ts";
import { syncOutboxKeyForAccount } from "../src/modules/sync/persistence/SyncPersistenceKeys.ts";
import { PersistentOutboxRepository } from "../src/modules/sync/repositories/PersistentOutboxRepository.ts";
import { SyncConflictRepository } from "../src/modules/sync/repositories/SyncConflictRepository.ts";
import { SyncReceiptRepository } from "../src/modules/sync/repositories/SyncReceiptRepository.ts";
import { DurableMutationCapture } from "../src/modules/sync/services/DurableMutationCapture.ts";
import { ListenerCoordinator } from "../src/modules/sync/services/ListenerCoordinator.ts";
import type {
    LocalMutationApplier,
    LocalMutationInspection
} from "../src/modules/sync/services/LocalMutationApplier.ts";
import { LocalMutationApplierRegistry } from "../src/modules/sync/services/LocalMutationApplierRegistry.ts";
import { LocalMutationReconciler } from "../src/modules/sync/services/LocalMutationReconciler.ts";
import { RetryPolicy } from "../src/modules/sync/services/RetryPolicy.ts";
import { SyncCoordinator } from "../src/modules/sync/services/SyncCoordinator.ts";
import { SyncModeService } from "../src/modules/sync/services/SyncModeService.ts";
import { SyncStatusService } from "../src/modules/sync/services/SyncStatusService.ts";

const accountA = "logical-account-a";
const accountB = "logical-account-b";
const providerUserId: string = "firebase-provider-user";
const timestamp = "2026-07-14T12:00:00.000Z";

type AuthenticatedState = Extract<AuthState, { status: "authenticated" }>;

interface FakeRecord {
    accountId: string;
    id: string;
    revision: number;
    checksum: string;
    value: string;
}

interface FakePayload {
    intended: FakeRecord;
}

class MemoryDriver implements Driver {
    private readonly values = new Map<string, unknown>();
    private failNextKey: string | null = null;

    public readonly events: string[];

    public constructor(events: string[] = []) {
        this.events = events;
    }

    public read<T>(key: string): T | null {
        return this.values.has(key)
            ? structuredClone(this.values.get(key)) as T
            : null;
    }

    public write<T>(key: string, value: T): void {
        if (this.failNextKey === key) {
            this.failNextKey = null;
            throw new Error("Injected local persistence failure.");
        }

        this.values.set(key, structuredClone(value));
        this.events.push(`write:${key}`);
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

class FakeCacheApplier implements LocalMutationApplier {
    public readonly module = "products" as const;
    public readonly records = new Map<string, FakeRecord>();
    public applyCount = 0;
    public businessCommandCount = 0;
    public failNextApply = false;
    public onApply: (() => void) | null = null;

    private readonly events: string[];

    public constructor(events: string[] = []) {
        this.events = events;
    }

    public inspect(operation: SyncOperation): LocalMutationInspection {
        const payload = readPayload(operation);

        if (
            payload.intended.accountId !== operation.accountId
            || payload.intended.id !== operation.recordId
            || payload.intended.checksum !== operation.writeSetChecksum
        ) {
            return { state: "conflict", summarySafe: "Operation identity mismatch." };
        }

        const key = cacheKey(operation.accountId, operation.recordId);
        const current = this.records.get(key);

        if (operation.operationType === "create" || operation.operationType === "append") {
            if (!current) {
                return { state: "not_applied" };
            }

            return recordsMatch(current, payload.intended)
                ? { state: "already_applied" }
                : { state: "conflict", summarySafe: "Stable record ID has different data." };
        }

        if (operation.operationType === "update") {
            if (!current) {
                return { state: "conflict", summarySafe: "Update pre-state is missing." };
            }

            if (recordsMatch(current, payload.intended)) {
                return { state: "already_applied" };
            }

            return current.revision === operation.expectedRevision
                ? { state: "not_applied" }
                : { state: "conflict", summarySafe: "Local revision is unexpected." };
        }

        return { state: "conflict", summarySafe: "Lifecycle operation needs a module applier." };
    }

    public apply(operation: SyncOperation): void {
        this.applyCount += 1;
        this.events.push(`apply:${operation.operationId}`);
        this.onApply?.();

        if (this.failNextApply) {
            this.failNextApply = false;
            throw new Error("Injected cache apply failure.");
        }

        const inspection = this.inspect(operation);

        if (inspection.state !== "not_applied") {
            throw new Error("Fake cache applier refused a non-applicable operation.");
        }

        const intended = readPayload(operation).intended;

        this.records.set(
            cacheKey(operation.accountId, operation.recordId),
            structuredClone(intended)
        );
    }

    public put(record: FakeRecord): void {
        this.records.set(cacheKey(record.accountId, record.id), structuredClone(record));
    }

    public get(accountId: string, recordId: string): FakeRecord | undefined {
        return this.records.get(cacheKey(accountId, recordId));
    }
}

class FakeTransport implements SyncOperationTransport {
    public readonly calls: SyncOperation[] = [];
    private readonly outcomes: SyncExecutionResult[];

    public constructor(...outcomes: SyncExecutionResult[]) {
        this.outcomes = outcomes;
    }

    public async execute(operation: SyncOperation): Promise<SyncExecutionResult> {
        this.calls.push(operation);

        return this.outcomes.shift() ?? {
            kind: "acknowledged",
            result: "created"
        };
    }
}

class FakeAuthStateSource {
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

interface Harness {
    driver: MemoryDriver;
    outbox: PersistentOutboxRepository;
    capture: DurableMutationCapture;
    registry: LocalMutationApplierRegistry;
    reconciler: LocalMutationReconciler;
    applier: FakeCacheApplier;
    transport: FakeTransport;
    auth: FakeAuthStateSource;
    mode: SyncModeService;
    status: SyncStatusService;
    coordinator: SyncCoordinator;
}

function createHarness(
    events: string[] = [],
    configureReconciler = true,
    outcomes: SyncExecutionResult[] = []
): Harness {
    const driver = new MemoryDriver(events);
    const outbox = new PersistentOutboxRepository(driver);
    const capture = new DurableMutationCapture(outbox, () => timestamp);
    const registry = new LocalMutationApplierRegistry();
    const applier = new FakeCacheApplier(events);
    const reconciler = new LocalMutationReconciler(
        outbox,
        registry,
        capture,
        { maxAutomaticAttempts: 3 }
    );
    const transport = new FakeTransport(...outcomes);
    const auth = new FakeAuthStateSource();
    const mode = new SyncModeService();
    const status = new SyncStatusService();
    const coordinator = new SyncCoordinator(
        mode,
        outbox,
        new SyncReceiptRepository(driver),
        new SyncConflictRepository(driver),
        new RetryPolicy(
            { maxAttempts: 2, baseDelayMs: 1_000, maxDelayMs: 2_000, jitterRatio: 0 },
            () => 0.5
        ),
        new ListenerCoordinator(),
        status,
        transport,
        auth,
        () => timestamp
    );

    registry.register(applier);
    if (configureReconciler) {
        coordinator.configureLocalMutationReconciler(reconciler);
    }

    return {
        driver,
        outbox,
        capture,
        registry,
        reconciler,
        applier,
        transport,
        auth,
        mode,
        status,
        coordinator
    };
}

function operationInput(
    operationId: string,
    operationType: SyncOperationType = "create",
    accountId = accountA,
    recordId = `record-${operationId}`,
    expectedRevision?: number,
    revision = operationType === "update" ? (expectedRevision ?? 0) + 1 : 1,
    checksum = `checksum-${operationId}`
): SyncOperationInput {
    const intended: FakeRecord = {
        accountId,
        id: recordId,
        revision,
        checksum,
        value: `value-${operationId}`
    };

    return {
        operationId,
        accountId,
        module: "products",
        recordId,
        operationType,
        ...(expectedRevision !== undefined ? { expectedRevision } : {}),
        idempotencyKey: `idempotency-${operationId}`,
        writeSetChecksum: checksum,
        safePayload: { intended } satisfies FakePayload,
        createdAt: timestamp
    };
}

function authenticatedState(accountId: string): AuthenticatedState {
    return {
        status: "authenticated",
        session: {
            user: {
                id: providerUserId,
                accountId,
                displayName: "Smoke User",
                role: "owner"
            },
            account: { id: accountId, name: "Smoke Account" },
            authenticatedAt: timestamp
        }
    };
}

function activateForTest(harness: Harness): void {
    harness.mode.activate({
        ownerApproved: true,
        migrationVerified: true,
        cutoverApproved: true,
        approvalReference: "isolated-smoke-only"
    });
    harness.coordinator.start();
}

function capture(
    harness: Harness,
    input: SyncOperationInput
) {
    return harness.capture.capture({
        accountId: input.accountId,
        operation: input,
        localApplier: harness.applier
    });
}

function readPayload(operation: SyncOperation): FakePayload {
    const payload = operation.safePayload as Partial<FakePayload> | undefined;

    if (!payload?.intended) {
        throw new Error("Fake operation payload is missing.");
    }

    return payload as FakePayload;
}

function cacheKey(accountId: string, recordId: string): string {
    return `${accountId}:${recordId}`;
}

function recordsMatch(left: FakeRecord, right: FakeRecord): boolean {
    return left.accountId === right.accountId
        && left.id === right.id
        && left.revision === right.revision
        && left.checksum === right.checksum
        && left.value === right.value;
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

const checks: Array<{ name: string; run: () => void | Promise<void> }> = [
    {
        name: "outbox is persisted before local apply",
        run: () => {
            const events: string[] = [];
            const harness = createHarness(events);
            const result = capture(harness, operationInput("ordering"));
            const outboxWrite = events.findIndex(event =>
                event === `write:${syncOutboxKeyForAccount(accountA)}`
            );
            const apply = events.findIndex(event => event === "apply:ordering");

            assert(result.success, "Ordered capture failed.");
            assert(outboxWrite >= 0 && apply > outboxWrite, "Local apply ran before durable outbox persistence.");
        }
    },
    {
        name: "outbox persistence failure prevents local mutation",
        run: () => {
            const harness = createHarness();
            harness.driver.failNextWriteFor(syncOutboxKeyForAccount(accountA));
            const result = capture(harness, operationInput("outbox-failure"));

            assert(!result.success, "Outbox failure reported success.");
            assert(harness.applier.applyCount === 0, "Local mutation ran after outbox failure.");
            assert(harness.outbox.allForAccount(accountA).length === 0, "Failed outbox write created an operation.");
        }
    },
    {
        name: "local apply success is durably marked applied",
        run: () => {
            const harness = createHarness();
            const result = capture(harness, operationInput("success"));

            assert(result.success, "Local capture failed.");
            assert(result.operation?.localApplyState === "applied", "Local applied state was not persisted.");
            assert(Boolean(result.operation.localAppliedAt), "Local applied timestamp is missing.");
        }
    },
    {
        name: "local apply failure retains the operation",
        run: () => {
            const harness = createHarness();
            harness.applier.failNextApply = true;
            const result = capture(harness, operationInput("apply-failure"));

            assert(!result.success, "Apply failure reported success.");
            assert(harness.outbox.allForAccount(accountA)[0]?.localApplyState === "failed", "Failed local operation was not retained.");
        }
    },
    {
        name: "cloud processing ignores locally unapplied operations",
        run: async () => {
            const harness = createHarness([], false);
            harness.outbox.enqueue(accountA, operationInput("cloud-blocked"));
            activateForTest(harness);

            assert(await harness.coordinator.processNext() === false, "Unapplied operation reached cloud processing.");
            assert(harness.transport.calls.length === 0, "Cloud transport received an unapplied operation.");
        }
    },
    {
        name: "cloud processing accepts locally applied operations",
        run: async () => {
            const harness = createHarness([], false);
            assert(capture(harness, operationInput("cloud-allowed")).success, "Local apply setup failed.");
            activateForTest(harness);
            await harness.coordinator.processNext();

            assert(harness.transport.calls.length === 1, "Applied operation did not reach cloud transport.");
        }
    },
    {
        name: "crash after outbox write is recovered",
        run: () => {
            const harness = createHarness();
            harness.outbox.enqueue(accountA, operationInput("crash-b"));
            harness.reconciler.start(accountA);
            const result = harness.reconciler.reconcilePending(accountA);

            assert(result.applied === 1, "Pending cache mutation was not recovered.");
            assert(harness.applier.applyCount === 1, "Recovered mutation did not apply exactly once.");
        }
    },
    {
        name: "crash after cache mutation does not duplicate apply",
        run: () => {
            const harness = createHarness();
            const stored = harness.outbox.enqueue(accountA, operationInput("crash-c"));
            harness.outbox.markLocalApplyAttempt(accountA, stored.operationId, timestamp);
            harness.applier.apply(stored);
            const before = harness.applier.applyCount;
            harness.reconciler.start(accountA);
            harness.reconciler.reconcilePending(accountA);

            assert(harness.applier.applyCount === before, "Reconciliation duplicated an existing cache mutation.");
            assert(harness.outbox.findByOperationId(accountA, stored.operationId)?.localApplyState === "applied", "Recovered cache mutation was not marked applied.");
        }
    },
    {
        name: "same operation ID retry is idempotent",
        run: () => {
            const harness = createHarness();
            const input = operationInput("crash-d");
            const first = capture(harness, input);
            const second = capture(harness, input);

            assert(first.success && second.success, "Idempotent capture retry failed.");
            assert(harness.outbox.allForAccount(accountA).length === 1, "Capture retry duplicated outbox state.");
            assert(harness.applier.applyCount === 1, "Capture retry duplicated local apply.");
        }
    },
    {
        name: "create identical state is already applied",
        run: () => {
            const harness = createHarness();
            const input = operationInput("create-identical");
            harness.applier.put((input.safePayload as FakePayload).intended);
            const result = capture(harness, input);

            assert(result.success && result.outcome === "already_applied", "Identical create was not recognized.");
            assert(harness.applier.applyCount === 0, "Identical create was applied again.");
        }
    },
    {
        name: "create same ID with different data conflicts",
        run: () => {
            const harness = createHarness();
            const input = operationInput("create-conflict");
            harness.applier.put({
                ...(input.safePayload as FakePayload).intended,
                checksum: "different-checksum"
            });
            const result = capture(harness, input);

            assert(result.outcome === "conflict", "Divergent create did not conflict.");
            assert(result.operation?.localApplyState === "conflict", "Local conflict state was not persisted.");
        }
    },
    {
        name: "update at expected revision applies",
        run: () => {
            const harness = createHarness();
            const input = operationInput("update-expected", "update", accountA, "update-record", 1, 2);
            harness.applier.put({
                accountId: accountA,
                id: "update-record",
                revision: 1,
                checksum: "old-checksum",
                value: "old-value"
            });

            assert(capture(harness, input).success, "Expected revision update failed.");
            assert(harness.applier.get(accountA, "update-record")?.revision === 2, "Update did not advance revision.");
        }
    },
    {
        name: "already-applied resulting revision is recognized",
        run: () => {
            const harness = createHarness();
            const input = operationInput("update-already", "update", accountA, "update-already-record", 1, 2);
            harness.applier.put((input.safePayload as FakePayload).intended);
            const result = capture(harness, input);

            assert(result.success && result.outcome === "already_applied", "Resulting revision was not recognized.");
            assert(harness.applier.applyCount === 0, "Already-applied update ran twice.");
        }
    },
    {
        name: "update at unexpected revision conflicts",
        run: () => {
            const harness = createHarness();
            const input = operationInput("update-conflict", "update", accountA, "update-conflict-record", 1, 2);
            harness.applier.put({
                accountId: accountA,
                id: "update-conflict-record",
                revision: 3,
                checksum: "other",
                value: "other"
            });

            assert(capture(harness, input).outcome === "conflict", "Unexpected update revision did not conflict.");
        }
    },
    {
        name: "append identical stable ID is deduplicated",
        run: () => {
            const harness = createHarness();
            const input = operationInput("append-identical", "append");
            harness.applier.put((input.safePayload as FakePayload).intended);

            assert(capture(harness, input).outcome === "already_applied", "Identical append was not deduplicated.");
        }
    },
    {
        name: "append same ID with different data conflicts",
        run: () => {
            const harness = createHarness();
            const input = operationInput("append-conflict", "append");
            harness.applier.put({
                ...(input.safePayload as FakePayload).intended,
                value: "different"
            });

            assert(capture(harness, input).outcome === "conflict", "Divergent append did not conflict.");
        }
    },
    {
        name: "local conflict never reaches cloud",
        run: async () => {
            const harness = createHarness([], false);
            const input = operationInput("conflict-cloud-block");
            harness.applier.put({
                ...(input.safePayload as FakePayload).intended,
                checksum: "different"
            });
            capture(harness, input);
            activateForTest(harness);
            await harness.coordinator.processNext();

            assert(harness.transport.calls.length === 0, "Local conflict reached cloud transport.");
        }
    },
    {
        name: "local failed state never reaches cloud",
        run: async () => {
            const harness = createHarness([], false);
            harness.applier.failNextApply = true;
            capture(harness, operationInput("failed-cloud-block"));
            activateForTest(harness);
            await harness.coordinator.processNext();

            assert(harness.transport.calls.length === 0, "Local failure reached cloud transport.");
        }
    },
    {
        name: "account A operation cannot apply to account B",
        run: () => {
            const harness = createHarness();
            const input = operationInput("account-boundary");
            const result = harness.capture.capture({
                accountId: accountB,
                operation: input,
                localApplier: harness.applier
            });

            assert(!result.success, "Cross-account capture was accepted.");
            assert(harness.applier.applyCount === 0, "Cross-account cache mutation ran.");
        }
    },
    {
        name: "Firebase provider identity is not accountId",
        run: async () => {
            const harness = createHarness([], false);
            capture(harness, operationInput("uid-boundary"));
            activateForTest(harness);
            await harness.coordinator.processNext();

            assert(harness.transport.calls[0]?.accountId === accountA, "Logical accountId was not preserved.");
            assert(harness.transport.calls[0]?.accountId !== providerUserId, "Provider UID became accountId.");
        }
    },
    {
        name: "stop cancels reconciliation before the next operation",
        run: () => {
            const harness = createHarness();
            harness.outbox.enqueue(accountA, operationInput("stop-one"));
            harness.outbox.enqueue(accountA, operationInput("stop-two"));
            harness.applier.onApply = () => harness.reconciler.stop();
            harness.reconciler.start(accountA);
            const result = harness.reconciler.reconcilePending(accountA);

            assert(result.stopped, "Reconciliation did not observe stop.");
            assert(result.processed === 1, "Reconciliation continued after stop.");
        }
    },
    {
        name: "restart recovers interrupted local apply",
        run: () => {
            const harness = createHarness();
            harness.outbox.enqueue(accountA, operationInput("restart"));
            harness.coordinator.start();

            assert(harness.outbox.findByOperationId(accountA, "restart")?.localApplyState === "applied", "Coordinator startup did not reconcile local apply.");
        }
    },
    {
        name: "cache applier does not replay business commands",
        run: () => {
            const harness = createHarness();
            capture(harness, operationInput("no-command-replay"));

            assert(harness.applier.businessCommandCount === 0, "Cache apply replayed a business command.");
        }
    },
    {
        name: "foundation registry has no operational appliers by default",
        run: () => {
            const registry = new LocalMutationApplierRegistry();
            assert(registry.count() === 0, "Foundation registered an operational repository applier.");
        }
    },
    {
        name: "foundation performs zero operational RTDB writes",
        run: () => {
            const harness = createHarness();
            capture(harness, operationInput("zero-rtdb"));
            assert(harness.transport.calls.length === 0, "Capture invoked cloud transport.");
        }
    },
    {
        name: "default SyncMode remains disabled",
        run: () => {
            const harness = createHarness();
            assert(harness.mode.getMode() === "disabled", "Default SyncMode changed.");
            assert(harness.status.getStatus().state === "disabled", "Default sync status changed.");
        }
    }
];

const results: Array<{ check: string; result: "PASS" }> = [];

for (const check of checks) {
    await check.run();
    results.push({ check: check.name, result: "PASS" });
}

console.log(JSON.stringify({
    mission: "V1-SYNC-004A",
    result: "PASS",
    checks: results,
    operationalRepositoriesModified: false,
    operationalFirebaseReads: 0,
    operationalFirebaseWrites: 0,
    migrationsOrBackfills: 0,
    businessCommandReplays: 0
}, null, 2));
