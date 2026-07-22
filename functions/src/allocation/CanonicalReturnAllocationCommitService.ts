import type { ReturnAllocationCommitRepository } from "./ReturnAllocationCommitRepository.js";
import type {
    CommitReturnAllocationRequest,
    CommitReturnAllocationResult
} from "./ReturnAllocationTypes.js";

export class CanonicalReturnAllocationCommitService {
    constructor(
        private readonly repository: ReturnAllocationCommitRepository,
        private readonly now: () => number = () => Date.now()
    ) {}

    commit(request: CommitReturnAllocationRequest): Promise<CommitReturnAllocationResult> {
        return this.repository.commit({ request, now: this.now() });
    }
}
