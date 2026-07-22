import type { Database, Reference } from "firebase-admin/database";
import { canonicalChecksum, normalizeJsonObject } from "./CanonicalJson.js";
import { CommercialCommandError } from "./CommercialCommandErrors.js";
import {
    buildInitialProcessingReceipt,
    completeProcessingReceipt,
    reclaimProcessingReceipt,
    type CommercialCommandReceiptStore,
    type ReceiptClaimInput,
    type ReceiptClaimResult,
    type ReceiptCompletionInput
} from "./CommercialCommandReceiptStore.js";
import type {
    CommercialCommandReceipt,
    CommercialCommandReceiptStatus
} from "./CommercialCommandTypes.js";

export class FirebaseCommercialCommandReceiptStore
implements CommercialCommandReceiptStore {
    constructor(private readonly database: Database) {}

    async claim(input: ReceiptClaimInput): Promise<ReceiptClaimResult> {
        const reference = this.receiptReference(
            input.request.accountId,
            input.request.commandId
        );
        const transaction = await reference.transaction(currentValue => {
            if (currentValue === null) {
                return buildInitialProcessingReceipt(input);
            }

            const current = parseReceipt(currentValue);
            assertReceiptIdentity(
                current,
                input.request.accountId,
                input.request.commandId
            );
            if (current.requestChecksum !== input.requestChecksum) {
                return undefined;
            }

            if (current.status !== "processing") {
                return undefined;
            }

            const leaseExpiresAt = current.processingLeaseExpiresAt ?? 0;
            if (leaseExpiresAt > input.now) {
                return undefined;
            }

            return reclaimProcessingReceipt(current, input);
        }, undefined, false);

        const receipt = parseReceipt(transaction.snapshot.val());
        assertReceiptIdentity(
            receipt,
            input.request.accountId,
            input.request.commandId
        );

        if (transaction.committed && receipt.processingLeaseId === input.leaseId) {
            return { kind: "acquired", receipt };
        }

        if (receipt.requestChecksum !== input.requestChecksum) {
            return { kind: "conflicting-request", receipt };
        }

        if (receipt.status === "processing") {
            return { kind: "processing", receipt };
        }

        return { kind: "terminal", receipt };
    }

    async complete(
        input: ReceiptCompletionInput
    ): Promise<CommercialCommandReceipt> {
        const reference = this.receiptReference(input.accountId, input.commandId);
        const resultChecksum = canonicalChecksum(
            normalizeJsonObject(handlerResultForChecksum(input.result))
        );
        const transaction = await reference.transaction(currentValue => {
            const current = parseReceipt(currentValue);
            assertReceiptIdentity(current, input.accountId, input.commandId);

            if (current.requestChecksum !== input.requestChecksum) {
                return undefined;
            }

            if (current.status !== "processing") {
                return undefined;
            }

            if (current.processingLeaseId !== input.leaseId) {
                return undefined;
            }

            return completeProcessingReceipt(current, input, resultChecksum);
        }, undefined, false);

        const receipt = parseReceipt(transaction.snapshot.val());
        assertReceiptIdentity(receipt, input.accountId, input.commandId);

        if (
            transaction.committed
            || (
                receipt.requestChecksum === input.requestChecksum
                && receipt.status !== "processing"
                && receipt.resultChecksum === resultChecksum
            )
        ) {
            return receipt;
        }

        throw new CommercialCommandError(
            "RECEIPT_STATE_CONFLICT",
            "Receipt completion lost its processing lease or found divergent state."
        );
    }

    async find(
        accountId: string,
        commandId: string
    ): Promise<CommercialCommandReceipt | null> {
        const snapshot = await this.receiptReference(accountId, commandId).get();
        if (!snapshot.exists()) {
            return null;
        }

        const receipt = parseReceipt(snapshot.val());
        assertReceiptIdentity(receipt, accountId, commandId);
        return receipt;
    }

    private receiptReference(accountId: string, commandId: string): Reference {
        return this.database.ref(
            `accounts/${accountId}/commercialCommandReceipts/${commandId}`
        );
    }
}

function handlerResultForChecksum(
    result: ReceiptCompletionInput["result"]
): Record<string, string | Record<string, unknown>> {
    return {
        status: result.status,
        ...(result.status !== "accepted" ? { errorCode: result.errorCode } : {}),
        ...(result.safeResultSummary
            ? { safeResultSummary: result.safeResultSummary }
            : {}),
        ...(result.status === "accepted" && result.publicationId
            ? { publicationId: result.publicationId }
            : {})
    };
}

function parseReceipt(value: unknown): CommercialCommandReceipt {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new CommercialCommandError(
            "RECEIPT_STATE_CONFLICT",
            "Receipt state is missing or malformed."
        );
    }

    const receipt = value as Partial<CommercialCommandReceipt>;
    const terminalStatuses: readonly CommercialCommandReceiptStatus[] = [
        "processing",
        "accepted",
        "rejected",
        "conflict"
    ];

    if (
        receipt.schemaVersion !== 1
        || typeof receipt.accountId !== "string"
        || typeof receipt.commandId !== "string"
        || typeof receipt.commandType !== "string"
        || typeof receipt.targetId !== "string"
        || typeof receipt.requestChecksum !== "string"
        || !terminalStatuses.includes(receipt.status as CommercialCommandReceiptStatus)
        || typeof receipt.attemptCount !== "number"
        || typeof receipt.createdAt !== "number"
        || typeof receipt.updatedAt !== "number"
    ) {
        throw new CommercialCommandError(
            "RECEIPT_STATE_CONFLICT",
            "Receipt state is malformed."
        );
    }

    return receipt as CommercialCommandReceipt;
}

function assertReceiptIdentity(
    receipt: CommercialCommandReceipt,
    accountId: string,
    commandId: string
): void {
    if (receipt.accountId !== accountId || receipt.commandId !== commandId) {
        throw new CommercialCommandError(
            "RECEIPT_STATE_CONFLICT",
            "Receipt identity does not match its account-scoped path."
        );
    }
}
