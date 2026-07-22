import type { Database, Reference } from "firebase-admin/database";
import type { ReturnAllocationCommitRepository } from "./ReturnAllocationCommitRepository.js";
import {
    evaluateReturnAllocationCommitTransaction
} from "./ReturnAllocationCommitTransaction.js";
import type {
    CommitReturnAllocationResult,
    ReturnAllocationCommitTransactionInput
} from "./ReturnAllocationTypes.js";

export class FirebaseReturnAllocationCommitRepository
implements ReturnAllocationCommitRepository {
    constructor(private readonly database: Database) {}

    async commit(
        input: ReturnAllocationCommitTransactionInput
    ): Promise<CommitReturnAllocationResult> {
        const reference = this.reference(
            input.request.accountId,
            input.request.invoiceId
        );
        // A commit can never create the aggregate baseline. Prime the local
        // transaction cache so an initial SDK null does not abort a valid CAS.
        await reference.get();
        let last = evaluateReturnAllocationCommitTransaction(null, input);
        const transaction = await reference.transaction(currentValue => {
            last = evaluateReturnAllocationCommitTransaction(currentValue, input);
            // Returning null (rather than undefined) lets the RTDB SDK submit
            // the cached-null hash and retry with the server value. If the
            // baseline is truly absent this remains a no-op, never a create.
            if (currentValue === null || currentValue === undefined) {
                return null;
            }
            return last.nextState ?? undefined;
        }, undefined, false);

        if (transaction.committed) {
            return last.result;
        }
        const final = evaluateReturnAllocationCommitTransaction(
            transaction.snapshot.val(),
            input
        );
        if (final.nextState !== null) {
            throw new Error("Return allocation commit stopped before persistence.");
        }
        return final.result;
    }

    private reference(accountId: string, invoiceId: string): Reference {
        return this.database.ref(
            `accounts/${accountId}/returnAllocations/${invoiceId}`
        );
    }
}
