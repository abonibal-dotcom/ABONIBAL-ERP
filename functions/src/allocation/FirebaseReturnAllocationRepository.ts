import type { Database, Reference } from "firebase-admin/database";
import type { ReturnAllocationRepository } from "./ReturnAllocationRepository.js";
import {
    evaluateReturnAllocationTransaction,
    parseReturnAllocationState
} from "./ReturnAllocationTransaction.js";
import type {
    ReserveReturnAllocationResult,
    ReturnAllocationState,
    ReturnAllocationTransactionInput
} from "./ReturnAllocationTypes.js";

export class FirebaseReturnAllocationRepository
implements ReturnAllocationRepository {
    constructor(private readonly database: Database) {}

    async reserve(
        input: ReturnAllocationTransactionInput
    ): Promise<ReserveReturnAllocationResult> {
        let lastEvaluation = evaluateReturnAllocationTransaction(null, input);
        const transaction = await this.reference(
            input.request.accountId,
            input.request.invoiceId
        ).transaction(currentValue => {
            lastEvaluation = evaluateReturnAllocationTransaction(currentValue, input);
            return lastEvaluation.nextState ?? undefined;
        }, undefined, false);

        if (transaction.committed) {
            return lastEvaluation.result;
        }

        const finalEvaluation = evaluateReturnAllocationTransaction(
            transaction.snapshot.val(),
            input
        );
        if (finalEvaluation.nextState !== null) {
            throw new Error("Return allocation transaction stopped before committing its state.");
        }
        return finalEvaluation.result;
    }

    async find(
        accountId: string,
        invoiceId: string
    ): Promise<ReturnAllocationState | null> {
        const snapshot = await this.reference(accountId, invoiceId).get();
        if (!snapshot.exists()) {
            return null;
        }
        const state = parseReturnAllocationState(snapshot.val());
        if (!state || state.accountId !== accountId || state.invoiceId !== invoiceId) {
            throw new Error("Return allocation state is malformed or path-inconsistent.");
        }
        return state;
    }

    private reference(accountId: string, invoiceId: string): Reference {
        return this.database.ref(
            `accounts/${accountId}/returnAllocations/${invoiceId}`
        );
    }
}
