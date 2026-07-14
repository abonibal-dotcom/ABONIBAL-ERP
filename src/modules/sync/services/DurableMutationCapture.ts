import type { SyncOperation, SyncOperationInput } from "../SyncOperation";
import type { PersistentOutboxRepository } from "../repositories/PersistentOutboxRepository";
import type {
    LocalMutationApplier,
    LocalMutationInspection
} from "./LocalMutationApplier";

export type LocalMutationCaptureOutcome =
    | "applied"
    | "already_applied"
    | "conflict"
    | "failed";

export interface LocalMutationCaptureRequest {
    accountId: string;
    operation: SyncOperationInput;
    localApplier: LocalMutationApplier;
}

export interface LocalMutationCaptureResult {
    success: boolean;
    outcome: LocalMutationCaptureOutcome;
    operation: SyncOperation | null;
    errors: string[];
}

export type LocalApplyClock = () => string;

export class DurableMutationCapture {
    private readonly outboxRepository: PersistentOutboxRepository;
    private readonly clock: LocalApplyClock;

    public constructor(
        outboxRepository: PersistentOutboxRepository,
        clock: LocalApplyClock = () => new Date().toISOString()
    ) {
        this.outboxRepository = outboxRepository;
        this.clock = clock;
    }

    public capture(request: LocalMutationCaptureRequest): LocalMutationCaptureResult {
        const validationError = validateCaptureRequest(request);

        if (validationError) {
            return failedResult(null, validationError);
        }

        let operation: SyncOperation;

        try {
            operation = this.outboxRepository.enqueue(
                request.accountId,
                request.operation
            );
        } catch {
            return failedResult(
                null,
                "Durable outbox persistence failed; local mutation was not run."
            );
        }

        if (operation.localApplyState === "applied") {
            return successfulResult(operation, "already_applied");
        }

        return this.applyPersistedOperation(operation, request.localApplier);
    }

    public applyPersistedOperation(
        operation: SyncOperation,
        localApplier: LocalMutationApplier
    ): LocalMutationCaptureResult {
        const current = this.outboxRepository.findByOperationId(
            operation.accountId,
            operation.operationId
        );

        if (!current) {
            return failedResult(null, "Persisted local mutation operation was not found.");
        }

        if (current.accountId !== operation.accountId) {
            return failedResult(current, "Local mutation account boundary mismatch.");
        }

        if (current.module !== localApplier.module) {
            return failedResult(current, "Local mutation applier module mismatch.");
        }

        if (current.localApplyState === "applied") {
            return successfulResult(current, "already_applied");
        }

        if (current.localApplyState === "conflict") {
            return conflictResult(current, "Local mutation is already in conflict.");
        }

        if (current.localApplyState === "failed") {
            return failedResult(current, "Local mutation requires an explicit recovery reset.");
        }

        let attempted: SyncOperation;

        try {
            attempted = this.outboxRepository.markLocalApplyAttempt(
                current.accountId,
                current.operationId,
                this.clock()
            );
        } catch {
            return failedResult(
                current,
                "Local apply attempt could not be persisted; cache mutation was not run."
            );
        }

        const initialInspection = this.inspectSafely(localApplier, attempted);

        if (!initialInspection) {
            return this.failPending(
                attempted,
                "local_apply_inspection_failed",
                "Local cache inspection failed."
            );
        }

        if (initialInspection.state === "already_applied") {
            return this.completeApplied(attempted, "already_applied");
        }

        if (initialInspection.state === "conflict") {
            return this.conflictPending(attempted, initialInspection);
        }

        try {
            localApplier.apply(attempted);
        } catch {
            return this.recoverAfterApplyError(localApplier, attempted);
        }

        const finalInspection = this.inspectSafely(localApplier, attempted);

        if (!finalInspection) {
            return this.failPending(
                attempted,
                "local_apply_verification_failed",
                "Local cache verification failed after apply."
            );
        }

        if (finalInspection.state === "already_applied") {
            return this.completeApplied(attempted, "applied");
        }

        if (finalInspection.state === "conflict") {
            return this.conflictPending(attempted, finalInspection);
        }

        return this.failPending(
            attempted,
            "local_apply_not_verified",
            "Local cache mutation could not be verified."
        );
    }

    private recoverAfterApplyError(
        localApplier: LocalMutationApplier,
        operation: SyncOperation
    ): LocalMutationCaptureResult {
        const inspection = this.inspectSafely(localApplier, operation);

        if (inspection?.state === "already_applied") {
            return this.completeApplied(operation, "applied");
        }

        if (inspection?.state === "conflict") {
            return this.conflictPending(operation, inspection);
        }

        return this.failPending(
            operation,
            "local_apply_failed",
            "Local cache mutation failed."
        );
    }

    private completeApplied(
        operation: SyncOperation,
        outcome: "applied" | "already_applied"
    ): LocalMutationCaptureResult {
        try {
            const applied = this.outboxRepository.markLocallyApplied(
                operation.accountId,
                operation.operationId,
                this.clock()
            );

            return successfulResult(applied, outcome);
        } catch {
            const retained = this.outboxRepository.findByOperationId(
                operation.accountId,
                operation.operationId
            ) ?? operation;

            return failedResult(
                retained,
                "Local cache changed, but durable local-applied marking failed; reconciliation is required."
            );
        }
    }

    private conflictPending(
        operation: SyncOperation,
        inspection: LocalMutationInspection
    ): LocalMutationCaptureResult {
        const message = inspection.summarySafe?.trim()
            || "Local cache state conflicts with the captured mutation.";

        try {
            const conflicted = this.outboxRepository.markLocalApplyConflict(
                operation.accountId,
                operation.operationId,
                "local_state_conflict",
                message
            );

            return conflictResult(conflicted, message);
        } catch {
            return conflictResult(operation, message);
        }
    }

    private failPending(
        operation: SyncOperation,
        errorCode: string,
        messageSafe: string
    ): LocalMutationCaptureResult {
        try {
            const failed = this.outboxRepository.markLocalApplyFailed(
                operation.accountId,
                operation.operationId,
                errorCode,
                messageSafe
            );

            return failedResult(failed, messageSafe);
        } catch {
            return failedResult(operation, messageSafe);
        }
    }

    private inspectSafely(
        localApplier: LocalMutationApplier,
        operation: SyncOperation
    ): LocalMutationInspection | null {
        try {
            return localApplier.inspect(operation);
        } catch {
            return null;
        }
    }
}

function validateCaptureRequest(
    request: LocalMutationCaptureRequest
): string | null {
    const accountId = request.accountId.trim();

    if (!accountId || request.operation.accountId.trim() !== accountId) {
        return "Local mutation requires one explicit matching accountId.";
    }

    if (request.operation.module !== request.localApplier.module) {
        return "Local mutation applier module does not match the operation.";
    }

    if (!request.operation.writeSetChecksum?.trim()) {
        return "Local mutation capture requires a write-set checksum.";
    }

    return null;
}

function successfulResult(
    operation: SyncOperation,
    outcome: "applied" | "already_applied"
): LocalMutationCaptureResult {
    return {
        success: true,
        outcome,
        operation,
        errors: []
    };
}

function conflictResult(
    operation: SyncOperation,
    message: string
): LocalMutationCaptureResult {
    return {
        success: false,
        outcome: "conflict",
        operation,
        errors: [message]
    };
}

function failedResult(
    operation: SyncOperation | null,
    message: string
): LocalMutationCaptureResult {
    return {
        success: false,
        outcome: "failed",
        operation,
        errors: [message]
    };
}
