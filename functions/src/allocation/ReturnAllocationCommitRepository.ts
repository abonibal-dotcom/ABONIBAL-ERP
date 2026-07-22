import type {
    CommitReturnAllocationResult,
    ReturnAllocationCommitTransactionInput
} from "./ReturnAllocationTypes.js";

export interface ReturnAllocationCommitRepository {
    commit(
        input: ReturnAllocationCommitTransactionInput
    ): Promise<CommitReturnAllocationResult>;
}
