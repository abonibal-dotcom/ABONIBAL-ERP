import type { Driver } from "../../../core/persistence/Driver";
import {
    createPendingSyncOperation,
    normalizeStoredSyncOperation,
    type LocalApplyState,
    type SyncOperation,
    type SyncOperationInput,
    type SyncOperationStatus
} from "../SyncOperation";
import {
    buildGroupedSyncOperationInputs,
    compareGroupedMembers,
    groupMembershipMatches,
    inspectSyncOperationGroup,
    isGroupedOperationCloudEligible,
    SyncOperationGroupConflictError,
    type SyncOperationGroupBatchInput
} from "../SyncOperationGroup";
import { syncOutboxKeyForAccount } from "../persistence/SyncPersistenceKeys";

export class PersistentOutboxRepository {
    private readonly driver: Driver;

    public constructor(driver: Driver) {
        this.driver = driver;
    }

    public allForAccount(accountId: string): SyncOperation[] {
        const normalizedAccountId = normalizeAccountId(accountId);
        const stored = this.driver.read<unknown>(
            syncOutboxKeyForAccount(normalizedAccountId)
        );

        if (!Array.isArray(stored)) {
            return [];
        }

        return stored
            .map(normalizeStoredSyncOperation)
            .filter((operation): operation is SyncOperation => operation !== null)
            .filter(operation => operation.accountId === normalizedAccountId);
    }

    public enqueue(
        accountId: string,
        input: SyncOperationInput
    ): SyncOperation {
        const normalizedAccountId = normalizeAccountId(accountId);

        if (input.group) {
            throw new Error(
                "Grouped sync operations require atomic batch enqueue."
            );
        }

        if (input.accountId.trim() !== normalizedAccountId) {
            throw new Error("Sync operation accountId does not match outbox account.");
        }

        const operations = this.allForAccount(normalizedAccountId);
        const duplicate = operations.find(operation =>
            operation.operationId === input.operationId.trim()
            || operation.idempotencyKey === input.idempotencyKey.trim()
        );

        if (duplicate) {
            if (!hasSameIdentity(duplicate, input)) {
                throw new Error("Sync operation identity collision detected.");
            }

            return duplicate;
        }

        const operation = createPendingSyncOperation(input);

        operations.push(operation);
        this.save(normalizedAccountId, operations);

        return operation;
    }

    public enqueueBatchAtomic(
        accountId: string,
        input: SyncOperationGroupBatchInput
    ): SyncOperation[] {
        const normalizedAccountId = normalizeAccountId(accountId);
        const groupedInputs = buildGroupedSyncOperationInputs(input);
        const candidates = groupedInputs.map(createPendingSyncOperation);

        if (candidates.some(
            operation => operation.accountId !== normalizedAccountId
        )) {
            throw new Error(
                "Sync operation group accountId does not match outbox account."
            );
        }

        const group = candidates[0].group;

        if (!group) {
            throw new Error("Atomic batch did not produce grouped operations.");
        }

        const operations = this.allForAccount(normalizedAccountId);
        const existingGroup = operations.filter(operation =>
            operation.group?.groupId === group.groupId
        );

        if (existingGroup.length > 0) {
            const inspection = inspectSyncOperationGroup(existingGroup);
            const exactMatch = inspection.valid
                && inspection.groupChecksum === group.groupChecksum
                && inspection.members.length === candidates.length
                && candidates.every(candidate =>
                    inspection.members.some(existing =>
                        hasSameGroupedIdentity(existing, candidate)
                    )
                );

            if (!exactMatch) {
                throw new SyncOperationGroupConflictError(
                    "Sync operation group identity conflict detected."
                );
            }

            return inspection.members;
        }

        for (const candidate of candidates) {
            const collision = operations.find(operation =>
                operation.operationId === candidate.operationId
                || operation.idempotencyKey === candidate.idempotencyKey
            );

            if (collision) {
                throw new SyncOperationGroupConflictError(
                    "Sync operation identity collision detected."
                );
            }
        }

        this.save(normalizedAccountId, [...operations, ...candidates]);

        return candidates.slice().sort(compareGroupedMembers);
    }

    public findByOperationId(
        accountId: string,
        operationId: string
    ): SyncOperation | undefined {
        const normalizedOperationId = requireText(operationId, "operationId");

        return this
            .allForAccount(accountId)
            .find(operation => operation.operationId === normalizedOperationId);
    }

    public getGroupMembers(
        accountId: string,
        groupId: string
    ): SyncOperation[] {
        const normalizedGroupId = requireText(groupId, "groupId");

        return this
            .allForAccount(accountId)
            .filter(operation => operation.group?.groupId === normalizedGroupId)
            .sort(compareGroupedMembers);
    }

    public hasOpenOperationForRecord(
        accountId: string,
        module: SyncOperation["module"],
        recordId: string
    ): boolean {
        const normalizedRecordId = requireText(recordId, "recordId");

        return this
            .allForAccount(accountId)
            .some(operation =>
                operation.module === module
                && operation.recordId === normalizedRecordId
                && operation.status !== "acknowledged"
            );
    }

    public getPending(
        accountId: string,
        now: string
    ): SyncOperation[] {
        const normalizedNow = requireText(now, "now");
        const operations = this.allForAccount(accountId);

        return operations
            .filter(operation => operation.status === "pending")
            .filter(operation => operation.localApplyState === "applied")
            .filter(operation =>
                !operation.nextAttemptAt
                || operation.nextAttemptAt <= normalizedNow
            )
            .filter(operation =>
                isGroupedOperationCloudEligible(operation, operations)
            )
            .sort(comparePendingOperations);
    }

    public getPendingLocalApply(accountId: string): SyncOperation[] {
        const operations = this.allForAccount(accountId);

        return operations
            .filter(operation => operation.localApplyState === "pending")
            .sort((left, right) =>
                compareLocalApplyOperations(left, right, operations)
            );
    }

    public markLocalApplyAttempt(
        accountId: string,
        operationId: string,
        attemptedAt: string
    ): SyncOperation {
        return this.updateLocalApply(
            accountId,
            operationId,
            ["pending"],
            operation => ({
                ...operation,
                localApplyAttemptCount: operation.localApplyAttemptCount + 1,
                localApplyLastAttemptAt: requireText(
                    attemptedAt,
                    "localApplyLastAttemptAt"
                ),
                localApplyErrorCode: undefined,
                localApplyErrorMessageSafe: undefined
            })
        );
    }

    public markLocallyApplied(
        accountId: string,
        operationId: string,
        appliedAt: string
    ): SyncOperation {
        const current = this.findByOperationId(accountId, operationId);

        if (current?.localApplyState === "applied") {
            return current;
        }

        return this.updateLocalApply(
            accountId,
            operationId,
            ["pending"],
            operation => ({
                ...operation,
                localApplyState: "applied",
                localAppliedAt: requireText(appliedAt, "localAppliedAt"),
                localApplyErrorCode: undefined,
                localApplyErrorMessageSafe: undefined
            })
        );
    }

    public markLocalApplyConflict(
        accountId: string,
        operationId: string,
        errorCode: string,
        messageSafe: string
    ): SyncOperation {
        return this.updateLocalApply(
            accountId,
            operationId,
            ["pending"],
            operation => ({
                ...operation,
                localApplyState: "conflict",
                localApplyErrorCode: requireText(errorCode, "localApplyErrorCode"),
                localApplyErrorMessageSafe: requireText(
                    messageSafe,
                    "localApplyErrorMessageSafe"
                )
            })
        );
    }

    public markLocalApplyFailed(
        accountId: string,
        operationId: string,
        errorCode: string,
        messageSafe: string
    ): SyncOperation {
        return this.updateLocalApply(
            accountId,
            operationId,
            ["pending"],
            operation => ({
                ...operation,
                localApplyState: "failed",
                localApplyErrorCode: requireText(errorCode, "localApplyErrorCode"),
                localApplyErrorMessageSafe: requireText(
                    messageSafe,
                    "localApplyErrorMessageSafe"
                )
            })
        );
    }

    public resetRecoverableLocalApply(
        accountId: string,
        operationId: string
    ): SyncOperation {
        return this.updateLocalApply(
            accountId,
            operationId,
            ["failed"],
            operation => ({
                ...operation,
                localApplyState: "pending",
                localApplyErrorCode: undefined,
                localApplyErrorMessageSafe: undefined
            })
        );
    }

    public markSyncing(
        accountId: string,
        operationId: string,
        attemptedAt: string
    ): SyncOperation {
        const normalizedAccountId = normalizeAccountId(accountId);
        const normalizedOperationId = requireText(operationId, "operationId");
        const operations = this.allForAccount(normalizedAccountId);
        const current = operations.find(operation =>
            operation.operationId === normalizedOperationId
        );

        if (!current) {
            throw new Error("Sync operation was not found.");
        }

        if (!isGroupedOperationCloudEligible(current, operations)) {
            throw new Error(
                "Cloud sync requires an eligible locally complete operation."
            );
        }

        return this.update(
            normalizedAccountId,
            normalizedOperationId,
            ["pending"],
            operation => {
                if (operation.localApplyState !== "applied") {
                    throw new Error("Cloud sync requires a locally applied operation.");
                }

                return {
                    ...operation,
                    status: "syncing",
                    attemptCount: operation.attemptCount + 1,
                    lastAttemptAt: requireText(attemptedAt, "attemptedAt"),
                    nextAttemptAt: undefined,
                    errorCode: undefined,
                    errorMessageSafe: undefined
                };
            }
        );
    }

    public markAcknowledged(
        accountId: string,
        operationId: string
    ): SyncOperation {
        return this.update(
            accountId,
            operationId,
            ["syncing"],
            operation => ({
                ...operation,
                status: "acknowledged",
                errorCode: undefined,
                errorMessageSafe: undefined
            })
        );
    }

    public markConflict(
        accountId: string,
        operationId: string,
        errorCode: string,
        messageSafe: string
    ): SyncOperation {
        return this.update(
            accountId,
            operationId,
            ["syncing"],
            operation => ({
                ...operation,
                status: "conflict",
                errorCode: requireText(errorCode, "errorCode"),
                errorMessageSafe: requireText(messageSafe, "errorMessageSafe")
            })
        );
    }

    public markFailed(
        accountId: string,
        operationId: string,
        errorCode: string,
        messageSafe: string
    ): SyncOperation {
        return this.update(
            accountId,
            operationId,
            ["syncing", "pending"],
            operation => ({
                ...operation,
                status: "failed",
                errorCode: requireText(errorCode, "errorCode"),
                errorMessageSafe: requireText(messageSafe, "errorMessageSafe"),
                nextAttemptAt: undefined
            })
        );
    }

    public scheduleRetry(
        accountId: string,
        operationId: string,
        nextAttemptAt: string,
        errorCode: string,
        messageSafe: string
    ): SyncOperation {
        return this.update(
            accountId,
            operationId,
            ["syncing"],
            operation => ({
                ...operation,
                status: "pending",
                nextAttemptAt: requireText(nextAttemptAt, "nextAttemptAt"),
                errorCode: requireText(errorCode, "errorCode"),
                errorMessageSafe: requireText(messageSafe, "errorMessageSafe")
            })
        );
    }

    public recoverInterruptedSyncingEntries(
        accountId: string,
        recoveredAt: string
    ): number {
        const normalizedAccountId = normalizeAccountId(accountId);
        const normalizedRecoveredAt = requireText(recoveredAt, "recoveredAt");
        const operations = this.allForAccount(normalizedAccountId);
        let recoveredCount = 0;
        const recovered = operations.map(operation => {
            if (operation.status !== "syncing") {
                return operation;
            }

            recoveredCount += 1;

            return {
                ...operation,
                status: "pending" as const,
                nextAttemptAt: normalizedRecoveredAt,
                errorCode: "interrupted_sync_recovered",
                errorMessageSafe: "Interrupted sync was recovered for explicit retry."
            };
        });

        if (recoveredCount > 0) {
            this.save(normalizedAccountId, recovered);
        }

        return recoveredCount;
    }

    public retryManually(
        accountId: string,
        operationId: string,
        requestedAt: string
    ): SyncOperation {
        return this.update(
            accountId,
            operationId,
            ["failed"],
            operation => ({
                ...operation,
                status: "pending",
                attemptCount: 0,
                nextAttemptAt: requireText(requestedAt, "requestedAt"),
                errorCode: undefined,
                errorMessageSafe: undefined
            })
        );
    }

    public removeAcknowledged(
        accountId: string,
        operationId: string
    ): void {
        const normalizedAccountId = normalizeAccountId(accountId);
        const normalizedOperationId = requireText(operationId, "operationId");
        const operations = this.allForAccount(normalizedAccountId);
        const operation = operations.find(
            candidate => candidate.operationId === normalizedOperationId
        );

        if (!operation) {
            return;
        }

        if (operation.status !== "acknowledged") {
            throw new Error("Only acknowledged sync operations can leave the active outbox.");
        }

        if (operation.group) {
            const groupMembers = operations.filter(candidate =>
                candidate.group?.groupId === operation.group?.groupId
            );
            const inspection = inspectSyncOperationGroup(groupMembers);

            if (!inspection.valid) {
                throw new Error(
                    "Invalid sync operation group cannot be removed."
                );
            }

            if (!groupMembers.every(
                member => member.status === "acknowledged"
            )) {
                return;
            }

            this.save(
                normalizedAccountId,
                operations.filter(candidate =>
                    candidate.group?.groupId !== operation.group?.groupId
                )
            );
            return;
        }

        this.save(
            normalizedAccountId,
            operations.filter(candidate =>
                candidate.operationId !== normalizedOperationId
            )
        );
    }

    public countByStatus(
        accountId: string,
        status: SyncOperationStatus
    ): number {
        return this
            .allForAccount(accountId)
            .filter(operation => operation.status === status)
            .length;
    }

    public countByLocalApplyState(
        accountId: string,
        state: LocalApplyState
    ): number {
        return this
            .allForAccount(accountId)
            .filter(operation => operation.localApplyState === state)
            .length;
    }

    private update(
        accountId: string,
        operationId: string,
        allowedStatuses: SyncOperationStatus[],
        updater: (operation: SyncOperation) => SyncOperation
    ): SyncOperation {
        const normalizedAccountId = normalizeAccountId(accountId);
        const normalizedOperationId = requireText(operationId, "operationId");
        const operations = this.allForAccount(normalizedAccountId);
        const operationIndex = operations.findIndex(
            operation => operation.operationId === normalizedOperationId
        );

        if (operationIndex === -1) {
            throw new Error("Sync operation was not found.");
        }

        const operation = operations[operationIndex];

        if (!allowedStatuses.includes(operation.status)) {
            throw new Error(`Sync operation cannot transition from ${operation.status}.`);
        }

        const updated = updater(operation);

        operations[operationIndex] = updated;
        this.save(normalizedAccountId, operations);

        return updated;
    }

    private updateLocalApply(
        accountId: string,
        operationId: string,
        allowedStates: LocalApplyState[],
        updater: (operation: SyncOperation) => SyncOperation
    ): SyncOperation {
        const normalizedAccountId = normalizeAccountId(accountId);
        const normalizedOperationId = requireText(operationId, "operationId");
        const operations = this.allForAccount(normalizedAccountId);
        const operationIndex = operations.findIndex(
            operation => operation.operationId === normalizedOperationId
        );

        if (operationIndex === -1) {
            throw new Error("Sync operation was not found.");
        }

        const operation = operations[operationIndex];

        if (!allowedStates.includes(operation.localApplyState)) {
            throw new Error(
                `Local apply cannot transition from ${operation.localApplyState}.`
            );
        }

        const updated = updater(operation);

        operations[operationIndex] = updated;
        this.save(normalizedAccountId, operations);

        return updated;
    }

    private save(accountId: string, operations: SyncOperation[]): void {
        this.driver.write<SyncOperation[]>(
            syncOutboxKeyForAccount(accountId),
            operations
        );
    }
}

function hasSameIdentity(
    operation: SyncOperation,
    input: SyncOperationInput
): boolean {
    return operation.operationId === input.operationId.trim()
        && operation.accountId === input.accountId.trim()
        && operation.module === input.module
        && operation.recordId === input.recordId.trim()
        && operation.operationType === input.operationType
        && operation.expectedRevision === input.expectedRevision
        && operation.idempotencyKey === input.idempotencyKey.trim()
        && operation.writeSetChecksum === input.writeSetChecksum?.trim();
}

function hasSameGroupedIdentity(
    existing: SyncOperation,
    candidate: SyncOperation
): boolean {
    return existing.operationId === candidate.operationId
        && existing.accountId === candidate.accountId
        && existing.module === candidate.module
        && existing.recordId === candidate.recordId
        && existing.operationType === candidate.operationType
        && existing.expectedRevision === candidate.expectedRevision
        && existing.idempotencyKey === candidate.idempotencyKey
        && existing.writeSetChecksum === candidate.writeSetChecksum
        && groupMembershipMatches(existing.group, candidate.group);
}

function comparePendingOperations(
    left: SyncOperation,
    right: SyncOperation
): number {
    if (
        left.group
        && right.group
        && left.group.groupId === right.group.groupId
    ) {
        return compareGroupedMembers(left, right);
    }

    const createdAtOrder = left.createdAt.localeCompare(right.createdAt);

    return createdAtOrder !== 0
        ? createdAtOrder
        : left.operationId.localeCompare(right.operationId);
}

function compareLocalApplyOperations(
    left: SyncOperation,
    right: SyncOperation,
    operations: SyncOperation[]
): number {
    const leftAnchor = groupQueueAnchor(left, operations);
    const rightAnchor = groupQueueAnchor(right, operations);
    const anchorOrder = leftAnchor.createdAt.localeCompare(
        rightAnchor.createdAt
    );

    if (anchorOrder !== 0) {
        return anchorOrder;
    }

    const bucketOrder = leftAnchor.bucket.localeCompare(rightAnchor.bucket);

    if (bucketOrder !== 0) {
        return bucketOrder;
    }

    return compareGroupedMembers(left, right)
        || left.operationId.localeCompare(right.operationId);
}

function groupQueueAnchor(
    operation: SyncOperation,
    operations: SyncOperation[]
): { createdAt: string; bucket: string } {
    if (!operation.group) {
        return {
            createdAt: operation.createdAt,
            bucket: `operation:${operation.operationId}`
        };
    }

    const createdAt = operations
        .filter(candidate =>
            candidate.group?.groupId === operation.group?.groupId
        )
        .map(candidate => candidate.createdAt)
        .sort()[0] ?? operation.createdAt;

    return {
        createdAt,
        bucket: `group:${operation.group.groupId}`
    };
}

function normalizeAccountId(accountId: string): string {
    return requireText(accountId, "accountId");
}

function requireText(value: string, field: string): string {
    const normalized = value.trim();

    if (!normalized) {
        throw new Error(`Sync ${field} is required.`);
    }

    return normalized;
}
