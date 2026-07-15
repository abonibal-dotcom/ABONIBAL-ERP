import {
    buildGroupedSyncOperationInputs,
    inspectSyncOperationGroup,
    SyncOperationGroupConflictError,
    type SyncOperationGroupBatchInput,
    type SyncOperationGroupInspection
} from "../SyncOperationGroup";
import type { SyncOperation } from "../SyncOperation";
import type { PersistentOutboxRepository } from "../repositories/PersistentOutboxRepository";
import type { DurableMutationCapture } from "./DurableMutationCapture";
import type { LocalMutationApplierRegistry } from "./LocalMutationApplierRegistry";

export type LocalMutationGroupCaptureOutcome =
    | "applied"
    | "already_applied"
    | "conflict"
    | "failed";

export interface LocalMutationGroupCaptureRequest {
    accountId: string;
    group: SyncOperationGroupBatchInput;
}

export interface LocalMutationGroupCaptureResult {
    success: boolean;
    outcome: LocalMutationGroupCaptureOutcome;
    inspection: SyncOperationGroupInspection | null;
    members: SyncOperation[];
    errors: string[];
}

export class DurableMutationGroupCapture {
    private readonly outboxRepository: PersistentOutboxRepository;
    private readonly applierRegistry: LocalMutationApplierRegistry;
    private readonly singleCapture: DurableMutationCapture;

    public constructor(
        outboxRepository: PersistentOutboxRepository,
        applierRegistry: LocalMutationApplierRegistry,
        singleCapture: DurableMutationCapture
    ) {
        this.outboxRepository = outboxRepository;
        this.applierRegistry = applierRegistry;
        this.singleCapture = singleCapture;
    }

    public capture(
        request: LocalMutationGroupCaptureRequest
    ): LocalMutationGroupCaptureResult {
        const accountId = request.accountId.trim();

        if (!accountId) {
            return failedResult(null, [], "Grouped mutation requires accountId.");
        }

        try {
            const prepared = buildGroupedSyncOperationInputs(request.group);

            if (prepared.some(operation => operation.accountId !== accountId)) {
                return failedResult(
                    null,
                    [],
                    "Grouped mutation requires one matching accountId."
                );
            }

            if (prepared.some(operation =>
                !this.applierRegistry.has(operation.module)
            )) {
                return failedResult(
                    null,
                    [],
                    "Grouped mutation requires every cache-only applier before persistence."
                );
            }
        } catch {
            return failedResult(
                null,
                [],
                "Grouped mutation validation failed before persistence."
            );
        }

        let members: SyncOperation[];

        try {
            members = this.outboxRepository.enqueueBatchAtomic(
                accountId,
                request.group
            );
        } catch (error) {
            if (error instanceof SyncOperationGroupConflictError) {
                const existing = this.outboxRepository.getGroupMembers(
                    accountId,
                    request.group.groupId
                );
                const inspection = existing.length > 0
                    ? inspectSyncOperationGroup(existing)
                    : null;

                return conflictResult(
                    inspection,
                    "Sync operation group identity conflicts with durable state.",
                    existing
                );
            }

            return failedResult(
                null,
                [],
                "Atomic group persistence failed; no local mutation was run."
            );
        }

        return this.applyPersistedGroup(accountId, request.group.groupId, members);
    }

    public applyPersistedGroup(
        accountId: string,
        groupId: string,
        initialMembers: SyncOperation[] = []
    ): LocalMutationGroupCaptureResult {
        const normalizedAccountId = accountId.trim();
        const normalizedGroupId = groupId.trim();

        if (!normalizedAccountId || !normalizedGroupId) {
            return failedResult(
                null,
                initialMembers,
                "Persisted group recovery requires explicit identities."
            );
        }

        let appliedDuringCall = false;

        for (const initialMember of this.outboxRepository.getGroupMembers(
            normalizedAccountId,
            normalizedGroupId
        )) {
            const inspection = this.inspect(
                normalizedAccountId,
                normalizedGroupId
            );

            if (!inspection.valid) {
                return conflictResult(
                    inspection,
                    inspection.errors[0]
                        ?? "Sync operation group integrity conflict.",
                    inspection.members
                );
            }

            if (inspection.localState === "conflict") {
                return conflictResult(
                    inspection,
                    "Sync operation group contains a local conflict.",
                    inspection.members
                );
            }

            if (inspection.localState === "failed") {
                return failedResult(
                    inspection,
                    inspection.members,
                    "Sync operation group contains a failed local member."
                );
            }

            const member = inspection.members.find(candidate =>
                candidate.operationId === initialMember.operationId
            );

            if (!member || member.localApplyState === "applied") {
                continue;
            }

            if (!this.applierRegistry.has(member.module)) {
                this.markMissingApplier(member);
                return failedResult(
                    this.inspect(normalizedAccountId, normalizedGroupId),
                    inspection.members,
                    "No approved cache-only applier exists for a group member."
                );
            }

            const applyResult = this.singleCapture.applyPersistedOperation(
                member,
                this.applierRegistry.resolve(member.module)
            );

            if (applyResult.outcome === "conflict") {
                return conflictResult(
                    this.inspect(normalizedAccountId, normalizedGroupId),
                    applyResult.errors[0]
                        ?? "Grouped local mutation conflicted.",
                    inspection.members
                );
            }

            if (!applyResult.success) {
                return failedResult(
                    this.inspect(normalizedAccountId, normalizedGroupId),
                    inspection.members,
                    applyResult.errors[0]
                        ?? "Grouped local mutation failed."
                );
            }

            appliedDuringCall = appliedDuringCall
                || applyResult.outcome === "applied";
        }

        const completed = this.inspect(normalizedAccountId, normalizedGroupId);

        if (!completed.valid) {
            return conflictResult(
                completed,
                completed.errors[0]
                    ?? "Sync operation group integrity conflict.",
                completed.members
            );
        }

        if (completed.localState !== "applied") {
            return failedResult(
                completed,
                completed.members,
                "Required group members are not locally applied."
            );
        }

        return {
            success: true,
            outcome: appliedDuringCall ? "applied" : "already_applied",
            inspection: completed,
            members: completed.members,
            errors: []
        };
    }

    private inspect(
        accountId: string,
        groupId: string
    ): SyncOperationGroupInspection {
        return inspectSyncOperationGroup(
            this.outboxRepository.getGroupMembers(accountId, groupId)
        );
    }

    private markMissingApplier(operation: SyncOperation): void {
        try {
            this.outboxRepository.markLocalApplyAttempt(
                operation.accountId,
                operation.operationId,
                new Date().toISOString()
            );
            this.outboxRepository.markLocalApplyFailed(
                operation.accountId,
                operation.operationId,
                "local_applier_missing",
                "No approved cache-only applier is registered for this module."
            );
        } catch {
            // The complete group remains in the durable outbox for recovery.
        }
    }
}

function conflictResult(
    inspection: SyncOperationGroupInspection | null,
    message: string,
    members: SyncOperation[]
): LocalMutationGroupCaptureResult {
    return {
        success: false,
        outcome: "conflict",
        inspection,
        members: inspection?.members ?? members,
        errors: [message]
    };
}

function failedResult(
    inspection: SyncOperationGroupInspection | null,
    members: SyncOperation[],
    message: string
): LocalMutationGroupCaptureResult {
    return {
        success: false,
        outcome: "failed",
        inspection,
        members: inspection?.members ?? members,
        errors: [message]
    };
}
