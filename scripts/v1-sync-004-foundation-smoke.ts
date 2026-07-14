import type { Driver } from "../src/core/persistence/Driver.ts";
import type { AuthState } from "../src/modules/auth/AuthState.ts";
import {
    SyncTransportError,
    type SyncExecutionResult,
    type SyncOperationTransport
} from "../src/modules/sync/SyncContracts.ts";
import type {
    SyncOperation,
    SyncOperationInput
} from "../src/modules/sync/SyncOperation.ts";
import {
    syncConflictsKeyForAccount,
    syncOutboxKeyForAccount,
    syncReceiptsKeyForAccount
} from "../src/modules/sync/persistence/SyncPersistenceKeys.ts";
import { PersistentOutboxRepository } from "../src/modules/sync/repositories/PersistentOutboxRepository.ts";
import { SyncConflictRepository } from "../src/modules/sync/repositories/SyncConflictRepository.ts";
import { SyncReceiptRepository } from "../src/modules/sync/repositories/SyncReceiptRepository.ts";
import { ListenerCoordinator } from "../src/modules/sync/services/ListenerCoordinator.ts";
import { RetryPolicy } from "../src/modules/sync/services/RetryPolicy.ts";
import { SyncCoordinator } from "../src/modules/sync/services/SyncCoordinator.ts";
import { SyncEchoPolicy } from "../src/modules/sync/services/SyncEchoPolicy.ts";
import { SyncModeService } from "../src/modules/sync/services/SyncModeService.ts";
import { SyncStatusService } from "../src/modules/sync/services/SyncStatusService.ts";

const accountA = "logical-account-a";
const accountB = "logical-account-b";
const nowA = "2026-07-14T10:00:00.000Z";
const nowB = "2026-07-14T10:00:02.000Z";

type AuthenticatedState = Extract<AuthState, { status: "authenticated" }>;

class MemoryDriver implements Driver {
    private readonly values = new Map<string, unknown>();

    public readonly writes: Array<{ key: string; value: unknown }> = [];

    public read<T>(key: string): T | null {
        return this.values.has(key)
            ? structuredClone(this.values.get(key)) as T
            : null;
    }

    public write<T>(key: string, value: T): void {
        const cloned = structuredClone(value);

        this.values.set(key, cloned);
        this.writes.push({ key, value: cloned });
    }

    public remove(key: string): void {
        this.values.delete(key);
    }

    public clear(): void {
        this.values.clear();
    }
}

class FakeAuthStateSource {
    private state: AuthState;

    private readonly subscribers = new Set<(state: AuthState) => void>();

    public constructor(accountId = accountA, providerUserId = "provider-user") {
        this.state = authenticatedState(accountId, providerUserId);
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

class FakeTransport implements SyncOperationTransport {
    public readonly calls: SyncOperation[] = [];

    private readonly outcomes: Array<SyncExecutionResult | Error>;

    public constructor(...outcomes: Array<SyncExecutionResult | Error>) {
        this.outcomes = outcomes;
    }

    public async execute(operation: SyncOperation): Promise<SyncExecutionResult> {
        this.calls.push(operation);
        const outcome = this.outcomes.shift();

        if (!outcome) {
            throw new SyncTransportError(
                "sync_test_missing_outcome",
                "Smoke transport has no configured outcome."
            );
        }

        if (outcome instanceof Error) {
            throw outcome;
        }

        return outcome;
    }
}

interface Harness {
    driver: MemoryDriver;
    auth: FakeAuthStateSource;
    mode: SyncModeService;
    outbox: PersistentOutboxRepository;
    receipts: SyncReceiptRepository;
    conflicts: SyncConflictRepository;
    listeners: ListenerCoordinator;
    status: SyncStatusService;
    transport: FakeTransport;
    coordinator: SyncCoordinator;
    setNow(value: string): void;
}

function createHarness(
    outcomes: Array<SyncExecutionResult | Error> = [],
    retryPolicy = new RetryPolicy(
        { maxAttempts: 2, baseDelayMs: 1_000, maxDelayMs: 2_000, jitterRatio: 0 },
        () => 0.5
    )
): Harness {
    const driver = new MemoryDriver();
    const auth = new FakeAuthStateSource();
    const mode = new SyncModeService();
    const outbox = new PersistentOutboxRepository(driver);
    const receipts = new SyncReceiptRepository(driver);
    const conflicts = new SyncConflictRepository(driver);
    const listeners = new ListenerCoordinator();
    const status = new SyncStatusService();
    const transport = new FakeTransport(...outcomes);
    let currentNow = nowA;
    const coordinator = new SyncCoordinator(
        mode,
        outbox,
        receipts,
        conflicts,
        retryPolicy,
        listeners,
        status,
        transport,
        auth,
        () => currentNow
    );

    return {
        driver,
        auth,
        mode,
        outbox,
        receipts,
        conflicts,
        listeners,
        status,
        transport,
        coordinator,
        setNow(value: string): void {
            currentNow = value;
        }
    };
}

function authenticatedState(
    accountId: string,
    providerUserId: string
): AuthenticatedState {
    return {
        status: "authenticated",
        session: {
            user: {
                id: providerUserId,
                accountId,
                displayName: "Smoke User",
                role: "owner"
            },
            account: {
                id: accountId,
                name: "Smoke Account"
            },
            authenticatedAt: nowA
        }
    };
}

function operationInput(
    operationId: string,
    accountId = accountA
): SyncOperationInput {
    return {
        operationId,
        accountId,
        module: "products",
        recordId: `record-${operationId}`,
        operationType: "create",
        idempotencyKey: `idempotency-${operationId}`,
        safePayload: { recordId: `record-${operationId}` },
        createdAt: nowA
    };
}

function enableMigration(harness: Harness): void {
    harness.mode.enterMigration({
        ownerApproved: true,
        migrationId: "smoke-migration"
    });
    harness.coordinator.start();
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

function assertThrows(action: () => void, message: string): void {
    let threw = false;

    try {
        action();
    } catch {
        threw = true;
    }

    assert(threw, message);
}

const checks: Array<{ name: string; run: () => void | Promise<void> }> = [
    {
        name: "default mode is disabled",
        run: () => {
            const harness = createHarness();

            assert(harness.mode.getMode() === "disabled", "Sync mode must default to disabled.");
            assert(harness.status.getStatus().state === "disabled", "Sync state must default to disabled.");
        }
    },
    {
        name: "disabled mode performs zero transport calls",
        run: async () => {
            const harness = createHarness();

            harness.outbox.enqueue(accountA, operationInput("disabled"));
            harness.coordinator.start();
            assert(await harness.coordinator.processNext() === false, "Disabled coordinator must not process.");
            assert(harness.transport.calls.length === 0, "Disabled coordinator reached transport.");
        }
    },
    {
        name: "outbox persists across repository restart",
        run: () => {
            const driver = new MemoryDriver();
            const first = new PersistentOutboxRepository(driver);

            first.enqueue(accountA, operationInput("persistent"));
            const restarted = new PersistentOutboxRepository(driver);
            assert(restarted.allForAccount(accountA).length === 1, "Persistent outbox entry was lost.");
        }
    },
    {
        name: "duplicate operation and idempotency identity are deduplicated",
        run: () => {
            const harness = createHarness();
            const input = operationInput("duplicate");

            harness.outbox.enqueue(accountA, input);
            harness.outbox.enqueue(accountA, input);
            assert(harness.outbox.allForAccount(accountA).length === 1, "Duplicate outbox entry was added.");
        }
    },
    {
        name: "markSyncing records one explicit attempt",
        run: () => {
            const harness = createHarness();

            harness.outbox.enqueue(accountA, operationInput("syncing"));
            const syncing = harness.outbox.markSyncing(accountA, "syncing", nowA);
            assert(syncing.status === "syncing", "Operation did not enter syncing state.");
            assert(syncing.attemptCount === 1 && syncing.lastAttemptAt === nowA, "Sync attempt metadata is incorrect.");
        }
    },
    {
        name: "acknowledgement saves receipt before outbox removal",
        run: async () => {
            const harness = createHarness([{
                kind: "acknowledged",
                result: "created",
                cloudRevision: 1
            }]);

            harness.outbox.enqueue(accountA, operationInput("ack"));
            enableMigration(harness);
            await harness.coordinator.processNext();
            assert(harness.receipts.allForAccount(accountA).length === 1, "Acknowledgement receipt missing.");
            assert(harness.outbox.allForAccount(accountA).length === 0, "Acknowledged outbox entry remains active.");

            const receiptIndex = harness.driver.writes.findIndex(write =>
                write.key === syncReceiptsKeyForAccount(accountA)
            );
            const removalIndex = harness.driver.writes.findIndex((write, index) =>
                index > receiptIndex
                && write.key === syncOutboxKeyForAccount(accountA)
                && Array.isArray(write.value)
                && write.value.length === 0
            );

            assert(receiptIndex >= 0 && removalIndex > receiptIndex, "Receipt was not persisted before outbox removal.");
        }
    },
    {
        name: "conflicts remain visible without overwrite",
        run: async () => {
            const harness = createHarness([{
                kind: "conflict",
                actualRevision: 4,
                summarySafe: "Revision conflict detected."
            }]);

            harness.outbox.enqueue(accountA, operationInput("conflict"));
            enableMigration(harness);
            await harness.coordinator.processNext();
            assert(harness.outbox.allForAccount(accountA)[0]?.status === "conflict", "Conflict left the outbox.");
            assert(harness.conflicts.allForAccount(accountA).length === 1, "Conflict record is not visible.");
        }
    },
    {
        name: "non-retryable failures remain visible",
        run: async () => {
            const harness = createHarness([
                new SyncTransportError("invalid_payload", "Payload is invalid.")
            ]);

            harness.outbox.enqueue(accountA, operationInput("failed"));
            enableMigration(harness);
            await harness.coordinator.processNext();
            assert(harness.outbox.allForAccount(accountA)[0]?.status === "failed", "Failed operation disappeared.");
        }
    },
    {
        name: "network retries are bounded",
        run: async () => {
            const harness = createHarness([
                new SyncTransportError("network_unavailable", "Network unavailable."),
                new SyncTransportError("network_unavailable", "Network unavailable.")
            ]);

            harness.outbox.enqueue(accountA, operationInput("retry"));
            enableMigration(harness);
            await harness.coordinator.processNext();
            assert(harness.outbox.allForAccount(accountA)[0]?.status === "pending", "First network failure was not queued for retry.");
            harness.setNow(nowB);
            await harness.coordinator.processNext();
            const operation = harness.outbox.allForAccount(accountA)[0];
            assert(operation?.status === "failed", "Retry limit did not move the operation to failed.");
            assert(operation.attemptCount === 2 && harness.transport.calls.length === 2, "Retry count exceeded the configured bound.");
        }
    },
    {
        name: "permission failures pause without a retry loop",
        run: async () => {
            const harness = createHarness([
                new SyncTransportError("permission_denied", "Permission denied.")
            ]);

            harness.outbox.enqueue(accountA, operationInput("permission"));
            enableMigration(harness);
            await harness.coordinator.processNext();
            assert(harness.status.getStatus().state === "paused", "Permission failure did not pause sync.");
            assert(await harness.coordinator.processNext() === false, "Paused sync processed another operation.");
            assert(harness.transport.calls.length === 1, "Permission failure entered a tight retry loop.");
        }
    },
    {
        name: "interrupted syncing entries recover as pending",
        run: () => {
            const harness = createHarness();

            harness.outbox.enqueue(accountA, operationInput("interrupted"));
            harness.outbox.markSyncing(accountA, "interrupted", nowA);
            harness.coordinator.start();
            const recovered = harness.outbox.findByOperationId(accountA, "interrupted");
            assert(recovered?.status === "pending", "Interrupted operation did not recover.");
            assert(recovered.errorCode === "interrupted_sync_recovered", "Recovery reason was not recorded.");
        }
    },
    {
        name: "persisted receipt prevents cloud replay after interruption",
        run: async () => {
            const harness = createHarness();

            harness.outbox.enqueue(accountA, operationInput("receipt-recovery"));
            harness.outbox.markSyncing(accountA, "receipt-recovery", nowA);
            harness.receipts.save({
                operationId: "receipt-recovery",
                accountId: accountA,
                module: "products",
                recordId: "record-receipt-recovery",
                idempotencyKey: "idempotency-receipt-recovery",
                result: "created",
                acknowledgedAt: nowA,
                cloudRevision: 1
            });
            enableMigration(harness);
            await harness.coordinator.processNext();
            assert(harness.outbox.allForAccount(accountA).length === 0, "Receipt-backed operation was not finalized.");
            assert(harness.transport.calls.length === 0, "Receipt-backed operation replayed a cloud write.");
        }
    },
    {
        name: "logout stops sync and removes listeners",
        run: () => {
            const harness = createHarness();
            let unsubscribeCount = 0;

            harness.coordinator.start();
            harness.listeners.register("account-listener", () => { unsubscribeCount += 1; });
            harness.auth.setState({ status: "unauthenticated" });
            assert(harness.status.getStatus().state === "stopped", "Logout did not stop sync.");
            assert(harness.listeners.count() === 0 && unsubscribeCount === 1, "Logout left an account listener active.");
        }
    },
    {
        name: "account switch detaches old account listeners",
        run: () => {
            const harness = createHarness();
            let unsubscribeCount = 0;

            harness.coordinator.start();
            harness.listeners.register("old-account", () => { unsubscribeCount += 1; });
            harness.auth.setState(authenticatedState(accountB, "provider-user"));
            assert(harness.status.getStatus().state === "stopped", "Account switch did not stop the old account context.");
            assert(unsubscribeCount === 1 && harness.listeners.count() === 0, "Old account listener remains active.");
        }
    },
    {
        name: "outbox receipts and conflicts use account-scoped keys",
        run: () => {
            assert(syncOutboxKeyForAccount(accountA) === `syncOutbox:${accountA}`, "Outbox key is not account scoped.");
            assert(syncReceiptsKeyForAccount(accountA) === `syncReceipts:${accountA}`, "Receipt key is not account scoped.");
            assert(syncConflictsKeyForAccount(accountA) === `syncConflicts:${accountA}`, "Conflict key is not account scoped.");
            assert(syncOutboxKeyForAccount(accountA) !== syncOutboxKeyForAccount(accountB), "Outbox keys cross account boundaries.");
        }
    },
    {
        name: "provider user ID is not used as accountId",
        run: async () => {
            const providerUserId: string = "firebase-provider-user-id";
            const harness = createHarness([{
                kind: "acknowledged",
                result: "created"
            }]);

            harness.auth.setState(authenticatedState(accountA, providerUserId));
            harness.outbox.enqueue(accountA, operationInput("identity"));
            enableMigration(harness);
            await harness.coordinator.processNext();
            assert(harness.transport.calls[0]?.accountId === accountA, "Provider user ID became operation accountId.");
            assert(harness.transport.calls[0]?.accountId !== providerUserId, "Firebase UID boundary was violated.");

            const mismatch = createHarness();
            mismatch.auth.setState({
                status: "authenticated",
                session: {
                    ...authenticatedState(accountA, providerUserId).session,
                    user: {
                        ...authenticatedState(accountA, providerUserId).session.user,
                        accountId: accountB
                    }
                }
            });
            assertThrows(() => mismatch.coordinator.start(), "Mismatched logical account IDs were accepted.");
        }
    },
    {
        name: "remote echo is suppressed without replaying commands",
        run: () => {
            const policy = new SyncEchoPolicy();
            const receipt = {
                operationId: "echo-operation",
                accountId: accountA,
                module: "products" as const,
                recordId: "record-echo",
                idempotencyKey: "echo-idempotency",
                result: "updated" as const,
                acknowledgedAt: nowA,
                cloudRevision: 2
            };

            assert(!policy.shouldApplyRemoteRecord({ operationId: "echo-operation", revision: 2 }, receipt), "Local echo was reapplied.");
            assert(policy.shouldApplyRemoteRecord({ operationId: "remote-operation", revision: 3 }, receipt), "Independent remote record was suppressed.");
        }
    },
    {
        name: "foundation registers no realtime listeners by default",
        run: () => {
            const harness = createHarness();

            harness.coordinator.start();
            assert(harness.listeners.count() === 0, "Foundation registered a realtime listener by default.");
            assert(harness.transport.calls.length === 0, "Foundation performed an operational write by default.");
        }
    }
];

const results: Array<{ check: string; result: "PASS" }> = [];

for (const check of checks) {
    await check.run();
    results.push({ check: check.name, result: "PASS" });
}

console.log(JSON.stringify({
    mission: "V1-SYNC-004",
    result: "PASS",
    checks: results,
    operationalFirebaseReads: 0,
    operationalFirebaseWrites: 0,
    businessCommandReplays: 0
}, null, 2));
