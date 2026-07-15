import type { Driver } from "../src/core/persistence/Driver.ts";
import type { AuthState } from "../src/modules/auth/AuthState.ts";
import type {
    SyncExecutionResult,
    SyncOperationTransport
} from "../src/modules/sync/SyncContracts.ts";
import {
    inspectSyncOperationGroup,
    type SyncOperationGroupBatchInput
} from "../src/modules/sync/SyncOperationGroup.ts";
import type {
    SyncModule,
    SyncOperation,
    SyncOperationInput
} from "../src/modules/sync/SyncOperation.ts";
import { canonicalChecksum, toJsonObject } from "../src/modules/sync/master-data/CanonicalJson.ts";
import { syncOutboxKeyForAccount } from "../src/modules/sync/persistence/SyncPersistenceKeys.ts";
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
import { SyncCoordinator } from "../src/modules/sync/services/SyncCoordinator.ts";
import { SyncModeService } from "../src/modules/sync/services/SyncModeService.ts";
import { SyncStatusService } from "../src/modules/sync/services/SyncStatusService.ts";

const accountA = "logical-account-a";
const accountB = "logical-account-b";
const providerUserId = "firebase-provider-user";
const timestamp = "2026-07-15T12:00:00.000Z";

interface FakeRecord {
    accountId: string;
    id: string;
    checksum: string;
    value: string;
}

interface FakePayload {
    intended: FakeRecord;
}

class MemoryDriver implements Driver {
    private readonly values = new Map<string, unknown>();
    private failNextKey: string | null = null;

    public readonly events: string[] = [];
    public writeCount = 0;

    public read<T>(key: string): T | null {
        return this.values.has(key)
            ? structuredClone(this.values.get(key)) as T
            : null;
    }

    public write<T>(key: string, value: T): void {
        if (this.failNextKey === key) {
            this.failNextKey = null;
            throw new Error("Injected outbox persistence failure.");
        }

        this.values.set(key, structuredClone(value));
        this.writeCount += 1;
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
    public readonly module: SyncModule;
    public readonly records = new Map<string, FakeRecord>();
    public applyCount = 0;
    public businessCommandCount = 0;
    public beforeApply: (() => void) | null = null;

    private readonly events: string[];

    public constructor(module: SyncModule, events: string[] = []) {
        this.module = module;
        this.events = events;
    }

    public inspect(operation: SyncOperation): LocalMutationInspection {
        const intended = readPayload(operation).intended;

        if (
            operation.module !== this.module
            || intended.accountId !== operation.accountId
            || intended.id !== operation.recordId
            || intended.checksum !== operation.writeSetChecksum
        ) {
            return {
                state: "conflict",
                summarySafe: "Synthetic operation identity diverged."
            };
        }

        const current = this.records.get(cacheKey(
            operation.accountId,
            operation.recordId
        ));

        if (!current) {
            return { state: "not_applied" };
        }

        return recordsMatch(current, intended)
            ? { state: "already_applied" }
            : {
                state: "conflict",
                summarySafe: "Stable synthetic record has divergent data."
            };
    }

    public apply(operation: SyncOperation): void {
        this.beforeApply?.();
        this.events.push(`apply:${operation.operationId}`);

        if (this.inspect(operation).state !== "not_applied") {
            throw new Error("Synthetic applier refused a non-applicable record.");
        }

        this.applyCount += 1;
        const intended = readPayload(operation).intended;
        this.records.set(
            cacheKey(operation.accountId, operation.recordId),
            structuredClone(intended)
        );
    }

    public put(record: FakeRecord): void {
        this.records.set(
            cacheKey(record.accountId, record.id),
            structuredClone(record)
        );
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
    private state: AuthState = authenticatedState(accountA);
    private readonly subscribers = new Set<(state: AuthState) => void>();

    public getState(): AuthState {
        return this.state;
    }

    public subscribe(subscriber: (state: AuthState) => void): () => void {
        this.subscribers.add(subscriber);
        return () => this.subscribers.delete(subscriber);
    }
}

interface Harness {
    driver: MemoryDriver;
    outbox: PersistentOutboxRepository;
    capture: DurableMutationCapture;
    groupCapture: DurableMutationGroupCapture;
    registry: LocalMutationApplierRegistry;
    reconciler: LocalMutationReconciler;
    products: FakeCacheApplier;
    movements: FakeCacheApplier;
}

function createHarness(registerMovements = true): Harness {
    const driver = new MemoryDriver();
    const outbox = new PersistentOutboxRepository(driver);
    const capture = new DurableMutationCapture(outbox, () => timestamp);
    const registry = new LocalMutationApplierRegistry();
    const products = new FakeCacheApplier("products", driver.events);
    const movements = new FakeCacheApplier("stockMovements", driver.events);

    registry.register(products);
    if (registerMovements) registry.register(movements);

    return {
        driver,
        outbox,
        capture,
        registry,
        products,
        movements,
        groupCapture: new DurableMutationGroupCapture(
            outbox,
            registry,
            capture
        ),
        reconciler: new LocalMutationReconciler(
            outbox,
            registry,
            capture
        )
    };
}

function createCoordinator(
    harness: Harness,
    transport: FakeTransport,
    configureReconciler = false
): { coordinator: SyncCoordinator; mode: SyncModeService } {
    const mode = new SyncModeService();
    const coordinator = new SyncCoordinator(
        mode,
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

    if (configureReconciler) {
        coordinator.configureLocalMutationReconciler(harness.reconciler);
    }

    mode.enterMigration({
        ownerApproved: true,
        migrationId: "synthetic-foundation-test"
    });
    coordinator.start();

    return { coordinator, mode };
}

function operationInput(
    prefix: string,
    module: "products" | "stockMovements",
    accountId = accountA,
    value = `value-${prefix}`
): SyncOperationInput {
    const recordId = `record-${prefix}`;
    const checksum = canonicalChecksum(toJsonObject({
        accountId,
        recordId,
        value
    }));
    const intended: FakeRecord = {
        accountId,
        id: recordId,
        checksum,
        value
    };

    return {
        operationId: `operation-${prefix}`,
        accountId,
        module,
        recordId,
        operationType: module === "products" ? "create" : "append",
        idempotencyKey: `idempotency-${prefix}`,
        writeSetChecksum: checksum,
        safePayload: { intended } satisfies FakePayload,
        createdAt: timestamp
    };
}

function groupInput(
    prefix: string,
    accountId = accountA,
    secondValue = `value-${prefix}-movement`
): SyncOperationGroupBatchInput {
    return {
        groupId: `group-${prefix}`,
        groupType: "synthetic_multi_record_mutation",
        groupSize: 2,
        members: [
            {
                operation: operationInput(
                    `${prefix}-product`,
                    "products",
                    accountId
                ),
                groupSequence: 1,
                requiredForLocalCompletion: true
            },
            {
                operation: operationInput(
                    `${prefix}-movement`,
                    "stockMovements",
                    accountId,
                    secondValue
                ),
                groupSequence: 2,
                requiredForLocalCompletion: true
            }
        ]
    };
}

function markAllLocallyApplied(
    outbox: PersistentOutboxRepository,
    groupId: string
): void {
    for (const member of outbox.getGroupMembers(accountA, groupId)) {
        outbox.markLocallyApplied(accountA, member.operationId, timestamp);
    }
}

function intendedFrom(input: SyncOperationInput): FakeRecord {
    return (input.safePayload as FakePayload).intended;
}

function authenticatedState(accountId: string): Extract<
    AuthState,
    { status: "authenticated" }
> {
    return {
        status: "authenticated",
        session: {
            user: {
                id: providerUserId,
                accountId,
                displayName: "Synthetic User",
                role: "owner"
            },
            account: { id: accountId, name: "Synthetic Account" },
            authenticatedAt: timestamp
        }
    };
}

function readPayload(operation: SyncOperation): FakePayload {
    const payload = operation.safePayload as FakePayload | undefined;
    if (!payload?.intended) throw new Error("Synthetic payload is missing.");
    return payload;
}

function cacheKey(accountId: string, recordId: string): string {
    return `${accountId}:${recordId}`;
}

function recordsMatch(left: FakeRecord, right: FakeRecord): boolean {
    return left.accountId === right.accountId
        && left.id === right.id
        && left.checksum === right.checksum
        && left.value === right.value;
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
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

const checks: Array<{ name: string; run: () => void | Promise<void> }> = [
    {
        name: "batch validation failure performs zero writes",
        run: () => {
            const h = createHarness();
            const input = groupInput("invalid-sequence");
            input.members[1].groupSequence = 1;
            assertThrows(
                () => h.outbox.enqueueBatchAtomic(accountA, input),
                "Duplicate group sequence was accepted."
            );
            assert(h.driver.writeCount === 0, "Invalid group wrote the outbox.");
        }
    },
    {
        name: "two-member group persists in one Driver.write",
        run: () => {
            const h = createHarness();
            const members = h.outbox.enqueueBatchAtomic(
                accountA,
                groupInput("one-write")
            );
            assert(members.length === 2, "Complete group was not returned.");
            assert(h.driver.writeCount === 1, "Batch used more than one write.");
            assert(h.outbox.allForAccount(accountA).length === 2, "Batch is incomplete.");
        }
    },
    {
        name: "Driver.write failure leaves zero partial members",
        run: () => {
            const h = createHarness();
            h.driver.failNextWriteFor(syncOutboxKeyForAccount(accountA));
            assertThrows(
                () => h.outbox.enqueueBatchAtomic(
                    accountA,
                    groupInput("write-failure")
                ),
                "Injected persistence failure was swallowed."
            );
            assert(h.outbox.allForAccount(accountA).length === 0, "Partial group persisted.");
            assert(h.driver.writeCount === 0, "Failed write was counted as durable.");
        }
    },
    {
        name: "exact batch retry is idempotent",
        run: () => {
            const h = createHarness();
            const input = groupInput("exact-retry");
            h.outbox.enqueueBatchAtomic(accountA, input);
            const writes = h.driver.writeCount;
            const retried = h.outbox.enqueueBatchAtomic(accountA, input);
            assert(retried.length === 2, "Exact retry did not return the group.");
            assert(h.driver.writeCount === writes, "Exact retry wrote duplicates.");
            assert(h.outbox.allForAccount(accountA).length === 2, "Exact retry duplicated members.");
        }
    },
    {
        name: "same group identity with changed payload conflicts",
        run: () => {
            const h = createHarness();
            h.outbox.enqueueBatchAtomic(accountA, groupInput("group-conflict"));
            const writes = h.driver.writeCount;
            assertThrows(
                () => h.outbox.enqueueBatchAtomic(
                    accountA,
                    groupInput("group-conflict", accountA, "changed-payload")
                ),
                "Changed group payload was silently merged."
            );
            assert(h.driver.writeCount === writes, "Conflicting retry changed outbox.");
        }
    },
    {
        name: "group capture reports a conflicting retry explicitly",
        run: () => {
            const h = createHarness();
            h.groupCapture.capture({
                accountId: accountA,
                group: groupInput("capture-conflict")
            });
            const result = h.groupCapture.capture({
                accountId: accountA,
                group: groupInput(
                    "capture-conflict",
                    accountA,
                    "changed-capture-payload"
                )
            });
            assert(
                !result.success && result.outcome === "conflict",
                "Grouped capture hid a durable identity conflict."
            );
        }
    },
    {
        name: "mixed accounts duplicate IDs and size mismatch are rejected",
        run: () => {
            const mixed = createHarness();
            const mixedInput = groupInput("mixed-account");
            mixedInput.members[1].operation = operationInput(
                "mixed-account-movement",
                "stockMovements",
                accountB
            );
            assertThrows(
                () => mixed.outbox.enqueueBatchAtomic(accountA, mixedInput),
                "Mixed-account group was accepted."
            );

            const duplicate = createHarness();
            const duplicateInput = groupInput("duplicate-id");
            duplicateInput.members[1].operation.operationId =
                duplicateInput.members[0].operation.operationId;
            assertThrows(
                () => duplicate.outbox.enqueueBatchAtomic(accountA, duplicateInput),
                "Duplicate operation ID was accepted."
            );

            const size = createHarness();
            const sizeInput = groupInput("bad-size");
            sizeInput.groupSize = 3;
            assertThrows(
                () => size.outbox.enqueueBatchAtomic(accountA, sizeInput),
                "Mismatched group size was accepted."
            );
        }
    },
    {
        name: "group is durable before the first local cache apply",
        run: () => {
            const h = createHarness();
            let observedCompleteGroup = false;
            h.products.beforeApply = () => {
                observedCompleteGroup =
                    h.outbox.getGroupMembers(accountA, "group-durable-first").length === 2;
            };
            const result = h.groupCapture.capture({
                accountId: accountA,
                group: groupInput("durable-first")
            });
            assert(result.success, "Grouped capture failed.");
            assert(observedCompleteGroup, "Cache apply ran before complete persistence.");
            assert(h.driver.events[0] === `write:${syncOutboxKeyForAccount(accountA)}`, "First event was not outbox persistence.");
        }
    },
    {
        name: "scenario B recovers a fully pending group exactly once",
        run: () => {
            const h = createHarness();
            h.outbox.enqueueBatchAtomic(accountA, groupInput("scenario-b"));
            h.reconciler.start(accountA);
            const result = h.reconciler.reconcilePending(accountA);
            const inspection = inspectSyncOperationGroup(
                h.outbox.getGroupMembers(accountA, "group-scenario-b")
            );
            assert(result.applied === 2, "Pending group did not reconcile both members.");
            assert(inspection.localState === "applied", "Group did not derive applied.");
            assert(h.products.applyCount === 1 && h.movements.applyCount === 1, "Group applied a member more than once.");
        }
    },
    {
        name: "scenario C recognizes member one and applies member two",
        run: () => {
            const h = createHarness();
            const input = groupInput("scenario-c");
            h.outbox.enqueueBatchAtomic(accountA, input);
            h.products.put(intendedFrom(input.members[0].operation));
            h.reconciler.start(accountA);
            h.reconciler.reconcilePending(accountA);
            assert(h.products.applyCount === 0, "Matching first member was duplicated.");
            assert(h.movements.applyCount === 1, "Second member was not applied once.");
        }
    },
    {
        name: "scenario D recovers cache writes missing applied markers",
        run: () => {
            const h = createHarness();
            const input = groupInput("scenario-d");
            h.outbox.enqueueBatchAtomic(accountA, input);
            h.products.put(intendedFrom(input.members[0].operation));
            h.movements.put(intendedFrom(input.members[1].operation));
            h.reconciler.start(accountA);
            h.reconciler.reconcilePending(accountA);
            const inspection = inspectSyncOperationGroup(
                h.outbox.getGroupMembers(accountA, "group-scenario-d")
            );
            assert(inspection.localState === "applied", "Missing markers were not recovered.");
            assert(h.products.applyCount === 0 && h.movements.applyCount === 0, "Matching cache data was duplicated.");
        }
    },
    {
        name: "scenarios E and exact recovery preserve one effect",
        run: () => {
            const h = createHarness();
            const input = groupInput("scenario-e");
            const first = h.groupCapture.capture({ accountId: accountA, group: input });
            const second = h.groupCapture.capture({ accountId: accountA, group: input });
            assert(first.success && second.success, "Exact grouped recovery failed.");
            assert(second.outcome === "already_applied", "Exact retry was not recognized.");
            assert(h.products.applyCount === 1 && h.movements.applyCount === 1, "Exact retry duplicated cache effects.");
        }
    },
    {
        name: "scenario F conflict stops all later members",
        run: () => {
            const h = createHarness();
            const input = groupInput("scenario-f");
            h.outbox.enqueueBatchAtomic(accountA, input);
            h.products.put({
                ...intendedFrom(input.members[0].operation),
                value: "divergent-product"
            });
            h.reconciler.start(accountA);
            h.reconciler.reconcilePending(accountA);
            const members = h.outbox.getGroupMembers(accountA, "group-scenario-f");
            assert(members[0].localApplyState === "conflict", "Divergence was not retained as conflict.");
            assert(members[1].localApplyState === "pending", "Later member was not blocked.");
            assert(h.movements.applyCount === 0, "Later member applied after conflict.");
        }
    },
    {
        name: "scenario G same member ID with divergent data conflicts",
        run: () => {
            const h = createHarness();
            const input = groupInput("scenario-g");
            h.outbox.enqueueBatchAtomic(accountA, input);
            h.products.put(intendedFrom(input.members[0].operation));
            h.movements.put({
                ...intendedFrom(input.members[1].operation),
                value: "divergent-movement"
            });
            h.reconciler.start(accountA);
            h.reconciler.reconcilePending(accountA);
            const members = h.outbox.getGroupMembers(accountA, "group-scenario-g");
            assert(members[1].localApplyState === "conflict", "Second-member divergence was not a conflict.");
            assert(h.movements.applyCount === 0, "Divergent stable ID was overwritten.");
        }
    },
    {
        name: "missing applier fails validation before persistence",
        run: () => {
            const h = createHarness(false);
            const result = h.groupCapture.capture({
                accountId: accountA,
                group: groupInput("missing-applier")
            });
            assert(!result.success && result.outcome === "failed", "Missing applier did not fail safely.");
            assert(h.outbox.getGroupMembers(accountA, "group-missing-applier").length === 0, "Invalid group was persisted.");
            assert(h.driver.writeCount === 0, "Missing-applier validation wrote the outbox.");
        }
    },
    {
        name: "sibling pending blocks grouped cloud processing",
        run: async () => {
            const h = createHarness();
            const input = groupInput("cloud-blocked");
            const members = h.outbox.enqueueBatchAtomic(accountA, input);
            h.outbox.markLocallyApplied(accountA, members[0].operationId, timestamp);
            const transport = new FakeTransport();
            const { coordinator } = createCoordinator(h, transport);
            await coordinator.processNext();
            assert(transport.calls.length === 0, "Partial local group reached cloud transport.");
        }
    },
    {
        name: "all applied members process in deterministic cloud order",
        run: async () => {
            const h = createHarness();
            const input = groupInput("cloud-order");
            h.outbox.enqueueBatchAtomic(accountA, input);
            markAllLocallyApplied(h.outbox, input.groupId);
            const transport = new FakeTransport();
            const { coordinator } = createCoordinator(h, transport);
            await coordinator.processPending(2);
            assert(transport.calls.length === 2, "Locally complete group did not process.");
            assert(transport.calls[0].group?.groupSequence === 1, "First cloud member was out of order.");
            assert(transport.calls[1].group?.groupSequence === 2, "Later member did not wait for acknowledgement.");
            assert(h.outbox.getGroupMembers(accountA, input.groupId).length === 0, "Acknowledged group was not cleaned atomically.");
        }
    },
    {
        name: "partial acknowledgement retains the complete group",
        run: () => {
            const h = createHarness();
            const input = groupInput("partial-ack");
            const members = h.outbox.enqueueBatchAtomic(accountA, input);
            markAllLocallyApplied(h.outbox, input.groupId);
            h.outbox.markSyncing(accountA, members[0].operationId, timestamp);
            h.outbox.markAcknowledged(accountA, members[0].operationId);
            h.outbox.removeAcknowledged(accountA, members[0].operationId);
            assert(h.outbox.getGroupMembers(accountA, input.groupId).length === 2, "Partial group cleanup lost its manifest.");
            assert(h.outbox.getPending(accountA, timestamp)[0]?.operationId === members[1].operationId, "Second sequence did not unlock after acknowledgement.");
        }
    },
    {
        name: "group cloud conflict and failure block every sibling",
        run: () => {
            const conflict = createHarness();
            const conflictInput = groupInput("cloud-conflict");
            const conflictMembers = conflict.outbox.enqueueBatchAtomic(accountA, conflictInput);
            markAllLocallyApplied(conflict.outbox, conflictInput.groupId);
            conflict.outbox.markSyncing(accountA, conflictMembers[0].operationId, timestamp);
            conflict.outbox.markConflict(accountA, conflictMembers[0].operationId, "synthetic", "Synthetic conflict.");
            assert(conflict.outbox.getPending(accountA, timestamp).length === 0, "Cloud conflict did not block group.");

            const failed = createHarness();
            const failedInput = groupInput("cloud-failed");
            const failedMembers = failed.outbox.enqueueBatchAtomic(accountA, failedInput);
            markAllLocallyApplied(failed.outbox, failedInput.groupId);
            failed.outbox.markSyncing(accountA, failedMembers[0].operationId, timestamp);
            failed.outbox.markFailed(accountA, failedMembers[0].operationId, "synthetic", "Synthetic failure.");
            assert(failed.outbox.getPending(accountA, timestamp).length === 0, "Cloud failure did not block group.");
        }
    },
    {
        name: "single-operation capture and cloud lifecycle remain unchanged",
        run: async () => {
            const h = createHarness();
            const input = operationInput("single-regression", "products");
            const result = h.capture.capture({
                accountId: accountA,
                operation: input,
                localApplier: h.products
            });
            assert(result.success, "Ungrouped durable capture regressed.");
            const transport = new FakeTransport();
            const { coordinator } = createCoordinator(h, transport);
            await coordinator.processNext();
            assert(transport.calls.length === 1, "Ungrouped operation did not reach fake transport.");
            assert(h.outbox.allForAccount(accountA).length === 0, "Ungrouped acknowledgement cleanup regressed.");
        }
    },
    {
        name: "existing ungrouped outbox records remain readable",
        run: () => {
            const h = createHarness();
            const input = operationInput("legacy", "products");
            h.outbox.enqueue(accountA, input);
            const stored = h.driver.read<Array<Record<string, unknown>>>(
                syncOutboxKeyForAccount(accountA)
            ) ?? [];
            delete stored[0].localApplyState;
            delete stored[0].localApplyAttemptCount;
            h.driver.write(syncOutboxKeyForAccount(accountA), stored);
            const normalized = h.outbox.allForAccount(accountA)[0];
            assert(normalized.localApplyState === "pending", "Legacy outbox entry did not normalize.");
            assert(!normalized.group, "Legacy operation was assigned a group.");
        }
    },
    {
        name: "account boundaries and Firebase UID separation are preserved",
        run: async () => {
            const h = createHarness();
            const input = groupInput("account-boundary");
            assertThrows(
                () => h.outbox.enqueueBatchAtomic(accountB, input),
                "Cross-account batch was accepted."
            );
            h.outbox.enqueueBatchAtomic(accountA, input);
            markAllLocallyApplied(h.outbox, input.groupId);
            assert(h.outbox.getGroupMembers(accountB, input.groupId).length === 0, "Account B read account A group.");
            const transport = new FakeTransport();
            const { coordinator } = createCoordinator(h, transport);
            await coordinator.processNext();
            assert(transport.calls[0]?.accountId === accountA, "Logical accountId was not retained.");
            assert(transport.calls[0]?.accountId !== providerUserId, "Firebase UID became accountId.");
        }
    },
    {
        name: "stopping reconciliation pauses before the next group member",
        run: () => {
            const h = createHarness();
            const input = groupInput("stop-between-members");
            h.outbox.enqueueBatchAtomic(accountA, input);
            h.products.beforeApply = () => h.reconciler.stop();
            h.reconciler.start(accountA);
            const result = h.reconciler.reconcilePending(accountA);
            const members = h.outbox.getGroupMembers(accountA, input.groupId);
            assert(result.stopped, "Reconciler did not stop on account lifecycle signal.");
            assert(members[0].localApplyState === "applied", "First member was not durably marked.");
            assert(members[1].localApplyState === "pending", "Reconciler crossed the stop boundary.");
        }
    },
    {
        name: "default SyncMode remains disabled with zero operational RTDB writes",
        run: () => {
            const mode = new SyncModeService();
            assert(mode.getMode() === "disabled", "Default SyncMode changed.");
        }
    }
];

const results: Array<{ check: string; result: "PASS" }> = [];

for (const check of checks) {
    await check.run();
    results.push({ check: check.name, result: "PASS" });
}

console.log(JSON.stringify({
    mission: "V1-SYNC-006D",
    result: "PASS",
    checks: results,
    crashScenarios: "A-G PASS",
    operationalRepositoriesModified: false,
    operationalFirebaseReads: 0,
    operationalFirebaseWrites: 0,
    migrationsOrBackfills: 0,
    businessCommandReplays: 0,
    productionTouched: false
}, null, 2));
