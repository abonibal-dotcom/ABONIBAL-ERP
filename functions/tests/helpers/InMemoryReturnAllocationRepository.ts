import type { ReturnAllocationRepository } from "../../src/allocation/ReturnAllocationRepository.js";
import {
    evaluateReturnAllocationTransaction,
    parseReturnAllocationState
} from "../../src/allocation/ReturnAllocationTransaction.js";
import type {
    ReserveReturnAllocationResult,
    ReturnAllocationState,
    ReturnAllocationTransactionInput
} from "../../src/allocation/ReturnAllocationTypes.js";

export class InMemoryReturnAllocationRepository
implements ReturnAllocationRepository {
    private readonly states = new Map<string, unknown>();
    private queue: Promise<void> = Promise.resolve();
    reserveCalls = 0;

    reserve(input: ReturnAllocationTransactionInput): Promise<ReserveReturnAllocationResult> {
        this.reserveCalls += 1;
        return this.serialized(() => {
            const key = this.key(input.request.accountId, input.request.invoiceId);
            const evaluation = evaluateReturnAllocationTransaction(
                this.states.get(key) ?? null,
                input
            );
            if (evaluation.nextState) {
                this.states.set(key, clone(evaluation.nextState));
            }
            return evaluation.result;
        });
    }

    async find(accountId: string, invoiceId: string): Promise<ReturnAllocationState | null> {
        const state = this.states.get(this.key(accountId, invoiceId));
        return state ? parseReturnAllocationState(clone(state)) : null;
    }

    seed(accountId: string, invoiceId: string, value: unknown): void {
        this.states.set(this.key(accountId, invoiceId), clone(value));
    }

    raw(accountId: string, invoiceId: string): unknown {
        const state = this.states.get(this.key(accountId, invoiceId));
        return state === undefined ? null : clone(state);
    }

    private key(accountId: string, invoiceId: string): string {
        return `${accountId}/${invoiceId}`;
    }

    private serialized<T>(work: () => T): Promise<T> {
        const result = this.queue.then(work);
        this.queue = result.then(() => undefined, () => undefined);
        return result;
    }
}

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}
