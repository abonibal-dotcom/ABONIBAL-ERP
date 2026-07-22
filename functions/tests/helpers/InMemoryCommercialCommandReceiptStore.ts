import {
    canonicalChecksum,
    normalizeJsonObject
} from "../../src/trusted/CanonicalJson.js";
import { CommercialCommandError } from "../../src/trusted/CommercialCommandErrors.js";
import {
    buildInitialProcessingReceipt,
    completeProcessingReceipt,
    reclaimProcessingReceipt,
    type CommercialCommandReceiptStore,
    type ReceiptClaimInput,
    type ReceiptClaimResult,
    type ReceiptCompletionInput
} from "../../src/trusted/CommercialCommandReceiptStore.js";
import type { CommercialCommandReceipt } from "../../src/trusted/CommercialCommandTypes.js";

export class InMemoryCommercialCommandReceiptStore
implements CommercialCommandReceiptStore {
    private readonly receipts = new Map<string, CommercialCommandReceipt>();
    private lock: Promise<void> = Promise.resolve();

    claim(input: ReceiptClaimInput): Promise<ReceiptClaimResult> {
        return this.exclusive(() => {
            const key = receiptKey(input.request.accountId, input.request.commandId);
            const current = this.receipts.get(key);

            if (!current) {
                const receipt = buildInitialProcessingReceipt(input);
                this.receipts.set(key, structuredClone(receipt));
                return { kind: "acquired", receipt: structuredClone(receipt) };
            }

            if (current.requestChecksum !== input.requestChecksum) {
                return {
                    kind: "conflicting-request",
                    receipt: structuredClone(current)
                };
            }

            if (current.status !== "processing") {
                return { kind: "terminal", receipt: structuredClone(current) };
            }

            if ((current.processingLeaseExpiresAt ?? 0) > input.now) {
                return { kind: "processing", receipt: structuredClone(current) };
            }

            const receipt = reclaimProcessingReceipt(current, input);
            this.receipts.set(key, structuredClone(receipt));
            return { kind: "acquired", receipt: structuredClone(receipt) };
        });
    }

    complete(input: ReceiptCompletionInput): Promise<CommercialCommandReceipt> {
        return this.exclusive(() => {
            const key = receiptKey(input.accountId, input.commandId);
            const current = this.receipts.get(key);

            if (
                !current
                || current.status !== "processing"
                || current.requestChecksum !== input.requestChecksum
                || current.processingLeaseId !== input.leaseId
            ) {
                throw new CommercialCommandError(
                    "RECEIPT_STATE_CONFLICT",
                    "Receipt completion found divergent state."
                );
            }

            const resultChecksum = canonicalChecksum(normalizeJsonObject(input.result));
            const receipt = completeProcessingReceipt(current, input, resultChecksum);
            this.receipts.set(key, structuredClone(receipt));
            return structuredClone(receipt);
        });
    }

    find(
        accountId: string,
        commandId: string
    ): Promise<CommercialCommandReceipt | null> {
        const receipt = this.receipts.get(receiptKey(accountId, commandId));
        return Promise.resolve(receipt ? structuredClone(receipt) : null);
    }

    get size(): number {
        return this.receipts.size;
    }

    private async exclusive<T>(operation: () => T | Promise<T>): Promise<T> {
        const previous = this.lock;
        let release!: () => void;
        this.lock = new Promise<void>(resolve => {
            release = resolve;
        });

        await previous;
        try {
            return await operation();
        } finally {
            release();
        }
    }
}

function receiptKey(accountId: string, commandId: string): string {
    return `${accountId}/${commandId}`;
}
