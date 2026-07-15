import type { PersistentOutboxRepository } from "../repositories/PersistentOutboxRepository";
import {
    inspectSyncOperationGroup,
    type SyncOperationGroupInspection
} from "../SyncOperationGroup";
import type { SyncOperation } from "../SyncOperation";
import type { DurableMutationCapture } from "./DurableMutationCapture";
import type { LocalMutationApplierRegistry } from "./LocalMutationApplierRegistry";

export interface LocalMutationReconciliationResult {
    processed: number;
    applied: number;
    conflicts: number;
    failed: number;
    stopped: boolean;
}

export interface LocalMutationReconcilerOptions {
    maxAutomaticAttempts: number;
}

const defaultOptions: LocalMutationReconcilerOptions = {
    maxAutomaticAttempts: 3
};

export class LocalMutationReconciler {
    private readonly outboxRepository: PersistentOutboxRepository;
    private readonly applierRegistry: LocalMutationApplierRegistry;
    private readonly capture: DurableMutationCapture;
    private readonly options: LocalMutationReconcilerOptions;

    private activeAccountId: string | null = null;

    public constructor(
        outboxRepository: PersistentOutboxRepository,
        applierRegistry: LocalMutationApplierRegistry,
        capture: DurableMutationCapture,
        options: LocalMutationReconcilerOptions = defaultOptions
    ) {
        if (
            !Number.isInteger(options.maxAutomaticAttempts)
            || options.maxAutomaticAttempts < 1
        ) {
            throw new Error("Local reconciliation max attempts must be positive.");
        }

        this.outboxRepository = outboxRepository;
        this.applierRegistry = applierRegistry;
        this.capture = capture;
        this.options = { ...options };
    }

    public start(accountId: string): void {
        this.activeAccountId = normalizeAccountId(accountId);
    }

    public stop(): void {
        this.activeAccountId = null;
    }

    public reconcilePending(
        accountId: string,
        maxOperations = 100
    ): LocalMutationReconciliationResult {
        const normalizedAccountId = normalizeAccountId(accountId);

        if (this.activeAccountId !== normalizedAccountId) {
            throw new Error("Local reconciliation account is not active.");
        }

        if (!Number.isInteger(maxOperations) || maxOperations < 1) {
            throw new Error("Local reconciliation maxOperations must be positive.");
        }

        this.resetBoundedFailures(normalizedAccountId);

        const result: LocalMutationReconciliationResult = {
            processed: 0,
            applied: 0,
            conflicts: 0,
            failed: 0,
            stopped: false
        };
        const operations = this.outboxRepository
            .getPendingLocalApply(normalizedAccountId)
            .slice(0, maxOperations);
        const blockedGroups = new Set<string>();

        for (const queuedOperation of operations) {
            if (this.activeAccountId !== normalizedAccountId) {
                result.stopped = true;
                break;
            }

            const operation = this.outboxRepository.findByOperationId(
                normalizedAccountId,
                queuedOperation.operationId
            );

            if (!operation || operation.localApplyState !== "pending") {
                continue;
            }

            if (operation.group) {
                const groupId = operation.group.groupId;

                if (blockedGroups.has(groupId)) {
                    continue;
                }

                const inspection = inspectSyncOperationGroup(
                    this.outboxRepository.getGroupMembers(
                        normalizedAccountId,
                        groupId
                    )
                );

                if (!inspection.valid) {
                    result.processed += 1;
                    this.markGroupIntegrityConflict(operation, inspection);
                    result.conflicts += 1;
                    blockedGroups.add(groupId);
                    continue;
                }

                if (inspection.localState === "conflict") {
                    blockedGroups.add(groupId);
                    continue;
                }

                if (inspection.localState === "failed") {
                    blockedGroups.add(groupId);
                    continue;
                }

                const earlierMemberIsIncomplete = inspection.members
                    .filter(member =>
                        member.group!.groupSequence
                        < operation.group!.groupSequence
                    )
                    .some(member => member.localApplyState !== "applied");

                if (earlierMemberIsIncomplete) {
                    continue;
                }
            }

            result.processed += 1;

            if (!this.applierRegistry.has(operation.module)) {
                this.markMissingApplier(operation.accountId, operation.operationId);
                result.failed += 1;
                continue;
            }

            const applyResult = this.capture.applyPersistedOperation(
                operation,
                this.applierRegistry.resolve(operation.module)
            );

            if (applyResult.success) {
                result.applied += 1;
            } else if (applyResult.outcome === "conflict") {
                result.conflicts += 1;
                if (operation.group) {
                    blockedGroups.add(operation.group.groupId);
                }
            } else {
                result.failed += 1;
                if (operation.group) {
                    blockedGroups.add(operation.group.groupId);
                }
            }
        }

        return result;
    }

    private resetBoundedFailures(accountId: string): void {
        const recoverable = this.outboxRepository
            .allForAccount(accountId)
            .filter(operation => operation.localApplyState === "failed")
            .filter(operation =>
                operation.localApplyAttemptCount < this.options.maxAutomaticAttempts
            );

        for (const operation of recoverable) {
            this.outboxRepository.resetRecoverableLocalApply(
                accountId,
                operation.operationId
            );
        }
    }

    private markMissingApplier(accountId: string, operationId: string): void {
        try {
            this.outboxRepository.markLocalApplyAttempt(
                accountId,
                operationId,
                new Date().toISOString()
            );
            this.outboxRepository.markLocalApplyFailed(
                accountId,
                operationId,
                "local_applier_missing",
                "No approved cache-only applier is registered for this module."
            );
        } catch {
            // The retained pending operation remains visible for manual recovery.
        }
    }

    private markGroupIntegrityConflict(
        operation: SyncOperation,
        inspection: SyncOperationGroupInspection
    ): void {
        const message = inspection.errors[0]
            ?? "Sync operation group integrity validation failed.";

        try {
            this.outboxRepository.markLocalApplyConflict(
                operation.accountId,
                operation.operationId,
                "local_group_integrity_conflict",
                message
            );
        } catch {
            // The malformed group remains durable and cloud-ineligible.
        }
    }
}

function normalizeAccountId(accountId: string): string {
    const normalized = accountId.trim();

    if (!normalized) {
        throw new Error("Local reconciliation requires an explicit accountId.");
    }

    return normalized;
}
