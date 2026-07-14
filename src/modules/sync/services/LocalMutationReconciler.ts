import type { PersistentOutboxRepository } from "../repositories/PersistentOutboxRepository";
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

        for (const operation of operations) {
            if (this.activeAccountId !== normalizedAccountId) {
                result.stopped = true;
                break;
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
            } else {
                result.failed += 1;
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
}

function normalizeAccountId(accountId: string): string {
    const normalized = accountId.trim();

    if (!normalized) {
        throw new Error("Local reconciliation requires an explicit accountId.");
    }

    return normalized;
}
