import type { Driver } from "../../../core/persistence/Driver";
import {
    createPendingSyncOperation,
    isStoredSyncOperation,
    type SyncOperation,
    type SyncOperationInput,
    type SyncOperationStatus
} from "../SyncOperation";
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
            .filter(isStoredSyncOperation)
            .filter(operation => operation.accountId === normalizedAccountId);
    }

    public enqueue(
        accountId: string,
        input: SyncOperationInput
    ): SyncOperation {
        const normalizedAccountId = normalizeAccountId(accountId);

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

    public findByOperationId(
        accountId: string,
        operationId: string
    ): SyncOperation | undefined {
        const normalizedOperationId = requireText(operationId, "operationId");

        return this
            .allForAccount(accountId)
            .find(operation => operation.operationId === normalizedOperationId);
    }

    public getPending(
        accountId: string,
        now: string
    ): SyncOperation[] {
        const normalizedNow = requireText(now, "now");

        return this
            .allForAccount(accountId)
            .filter(operation => operation.status === "pending")
            .filter(operation =>
                !operation.nextAttemptAt
                || operation.nextAttemptAt <= normalizedNow
            )
            .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    }

    public markSyncing(
        accountId: string,
        operationId: string,
        attemptedAt: string
    ): SyncOperation {
        return this.update(
            accountId,
            operationId,
            ["pending"],
            operation => ({
                ...operation,
                status: "syncing",
                attemptCount: operation.attemptCount + 1,
                lastAttemptAt: requireText(attemptedAt, "attemptedAt"),
                nextAttemptAt: undefined,
                errorCode: undefined,
                errorMessageSafe: undefined
            })
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
        && operation.idempotencyKey === input.idempotencyKey.trim();
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
