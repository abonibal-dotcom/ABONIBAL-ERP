import type {
    ReserveReturnAllocationResult,
    ReturnAllocationState,
    ReturnAllocationTransactionInput
} from "./ReturnAllocationTypes.js";

export interface ReturnAllocationRepository {
    reserve(
        input: ReturnAllocationTransactionInput
    ): Promise<ReserveReturnAllocationResult>;
    find(accountId: string, invoiceId: string): Promise<ReturnAllocationState | null>;
}
