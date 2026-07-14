import type { Driver } from "../../../core/persistence/Driver";
import { isSyncConflictStatus, type SyncConflict } from "../SyncConflict";
import { isSyncModule } from "../SyncOperation";
import { syncConflictsKeyForAccount } from "../persistence/SyncPersistenceKeys";

export class SyncConflictRepository {
    private readonly driver: Driver;

    public constructor(driver: Driver) {
        this.driver = driver;
    }

    public allForAccount(accountId: string): SyncConflict[] {
        const normalizedAccountId = normalizeAccountId(accountId);
        const stored = this.driver.read<unknown>(
            syncConflictsKeyForAccount(normalizedAccountId)
        );

        if (!Array.isArray(stored)) {
            return [];
        }

        return stored
            .filter(isSyncConflict)
            .filter(conflict => conflict.accountId === normalizedAccountId);
    }

    public save(conflict: SyncConflict): SyncConflict {
        const normalizedAccountId = normalizeAccountId(conflict.accountId);

        if (!isSyncConflict(conflict)) {
            throw new Error("Sync conflict is invalid.");
        }

        const conflicts = this.allForAccount(normalizedAccountId);
        const existing = conflicts.find(candidate =>
            candidate.conflictId === conflict.conflictId
            || candidate.operationId === conflict.operationId
        );

        if (existing) {
            return existing;
        }

        conflicts.push(conflict);
        this.saveAll(normalizedAccountId, conflicts);

        return conflict;
    }

    public findByOperationId(
        accountId: string,
        operationId: string
    ): SyncConflict | undefined {
        const normalizedOperationId = requireText(operationId, "operationId");

        return this
            .allForAccount(accountId)
            .find(conflict => conflict.operationId === normalizedOperationId);
    }

    public markResolved(
        accountId: string,
        conflictId: string,
        resolvedAt: string
    ): SyncConflict {
        return this.updateStatus(accountId, conflictId, "resolved", resolvedAt);
    }

    public markDismissed(
        accountId: string,
        conflictId: string,
        dismissedAt: string
    ): SyncConflict {
        return this.updateStatus(accountId, conflictId, "dismissed", dismissedAt);
    }

    private updateStatus(
        accountId: string,
        conflictId: string,
        status: "resolved" | "dismissed",
        resolvedAt: string
    ): SyncConflict {
        const normalizedAccountId = normalizeAccountId(accountId);
        const normalizedConflictId = requireText(conflictId, "conflictId");
        const conflicts = this.allForAccount(normalizedAccountId);
        const index = conflicts.findIndex(
            conflict => conflict.conflictId === normalizedConflictId
        );

        if (index === -1) {
            throw new Error("Sync conflict was not found.");
        }

        const updated: SyncConflict = {
            ...conflicts[index],
            status,
            resolvedAt: requireText(resolvedAt, "resolvedAt")
        };

        conflicts[index] = updated;
        this.saveAll(normalizedAccountId, conflicts);

        return updated;
    }

    private saveAll(accountId: string, conflicts: SyncConflict[]): void {
        this.driver.write<SyncConflict[]>(
            syncConflictsKeyForAccount(accountId),
            conflicts
        );
    }
}

function isSyncConflict(value: unknown): value is SyncConflict {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }

    const conflict = value as Partial<SyncConflict>;

    return isNonEmptyText(conflict.conflictId)
        && isNonEmptyText(conflict.accountId)
        && isNonEmptyText(conflict.operationId)
        && isSyncModule(conflict.module)
        && isNonEmptyText(conflict.recordId)
        && isNonEmptyText(conflict.detectedAt)
        && isNonEmptyText(conflict.summarySafe)
        && isSyncConflictStatus(conflict.status);
}

function normalizeAccountId(accountId: string): string {
    return requireText(accountId, "accountId");
}

function requireText(value: string, field: string): string {
    const normalized = value.trim();

    if (!normalized) {
        throw new Error(`Sync conflict ${field} is required.`);
    }

    return normalized;
}

function isNonEmptyText(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}
