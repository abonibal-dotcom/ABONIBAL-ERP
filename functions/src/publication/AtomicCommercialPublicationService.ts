import type { ReturnAllocationCommitRepository } from "../allocation/ReturnAllocationCommitRepository.js";
import type {
    CommitReturnAllocationResult
} from "../allocation/ReturnAllocationTypes.js";
import type { AtomicCommercialPublicationRepository } from "./AtomicCommercialPublicationRepository.js";
import {
    buildAtomicCommercialPublicationPlan,
    validateExecuteReturnPublicationRequest
} from "./CommercialPublicationPlanBuilder.js";
import type {
    ExecuteReturnPublicationRequest,
    ExecuteReturnPublicationResult
} from "./CommercialPublicationTypes.js";

export class AtomicCommercialPublicationService {
    constructor(
        private readonly allocationCommits: ReturnAllocationCommitRepository,
        private readonly publications: AtomicCommercialPublicationRepository,
        private readonly now: () => number = () => Date.now()
    ) {}

    async publishExecutedReturn(
        request: ExecuteReturnPublicationRequest
    ): Promise<ExecuteReturnPublicationResult> {
        try {
            validateExecuteReturnPublicationRequest(request);
        } catch (error) {
            return {
                kind: "rejected",
                code: error instanceof Error
                    && error.message === "DOCUMENT_NUMBER_PROOF_REQUIRED"
                    ? "DOCUMENT_NUMBER_PROOF_REQUIRED"
                    : "INVALID_PUBLICATION_REQUEST"
            };
        }

        const now = this.now();
        const allocation = await this.allocationCommits.commit({
            request: {
                schemaVersion: 1,
                accountId: request.accountId,
                invoiceId: request.invoiceId,
                returnId: request.returnId,
                commandId: request.commandId,
                commandType: request.commandType,
                requestChecksum: request.requestChecksum,
                reservationChecksum: request.reservationChecksum,
                publicationId: request.commandId
            },
            now
        });
        if (allocation.kind === "rejected") {
            return { kind: "conflict", code: "ALLOCATION_STATE_CONFLICT" };
        }
        if (allocation.kind === "conflict") {
            return {
                kind: "conflict",
                code: mapAllocationConflict(allocation)
            };
        }

        let plan;
        try {
            plan = buildAtomicCommercialPublicationPlan(
                request,
                allocation.commit,
                now
            );
        } catch (error) {
            return {
                kind: "conflict",
                code: error instanceof Error
                    && error.message === "RECEIPT_STATE_CONFLICT"
                    ? "RECEIPT_STATE_CONFLICT"
                    : error instanceof Error
                        && error.message === "RETURN_BASELINE_CONFLICT"
                        ? "RETURN_BASELINE_CONFLICT"
                        : "ALLOCATION_COMMIT_CONFLICT"
            };
        }
        return this.publications.publish(plan);
    }
}

function mapAllocationConflict(
    result: Extract<CommitReturnAllocationResult, { kind: "conflict" }>
): "ALLOCATION_COMMIT_CONFLICT"
    | "ALLOCATION_STATE_CONFLICT"
    | "RESERVATION_CHECKSUM_CONFLICT" {
    return result.code;
}
