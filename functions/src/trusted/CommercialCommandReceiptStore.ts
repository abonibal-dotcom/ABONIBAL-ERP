import type {
    CommercialCommandReceipt,
    CommercialCommandRequest,
    TrustedCommandHandlerResult
} from "./CommercialCommandTypes.js";

export type ReceiptClaimInput = {
    request: CommercialCommandRequest;
    requestChecksum: string;
    now: number;
    leaseId: string;
    leaseDurationMs: number;
};

export type ReceiptClaimResult =
    | {
        kind: "acquired";
        receipt: CommercialCommandReceipt;
    }
    | {
        kind: "processing";
        receipt: CommercialCommandReceipt;
    }
    | {
        kind: "terminal";
        receipt: CommercialCommandReceipt;
    }
    | {
        kind: "conflicting-request";
        receipt: CommercialCommandReceipt;
    };

export type ReceiptCompletionInput = {
    accountId: string;
    commandId: string;
    requestChecksum: string;
    leaseId: string;
    now: number;
    result: TrustedCommandHandlerResult;
};

export interface CommercialCommandReceiptStore {
    claim(input: ReceiptClaimInput): Promise<ReceiptClaimResult>;
    complete(input: ReceiptCompletionInput): Promise<CommercialCommandReceipt>;
    find(accountId: string, commandId: string): Promise<CommercialCommandReceipt | null>;
}

export function buildInitialProcessingReceipt(
    input: ReceiptClaimInput
): CommercialCommandReceipt {
    return {
        schemaVersion: 1,
        accountId: input.request.accountId,
        commandId: input.request.commandId,
        commandType: input.request.commandType,
        targetId: input.request.targetId,
        requestChecksum: input.requestChecksum,
        status: "processing",
        attemptCount: 1,
        createdAt: input.now,
        updatedAt: input.now,
        processingLeaseId: input.leaseId,
        processingLeaseExpiresAt: input.now + input.leaseDurationMs
    };
}

export function reclaimProcessingReceipt(
    receipt: CommercialCommandReceipt,
    input: ReceiptClaimInput
): CommercialCommandReceipt {
    return {
        ...receipt,
        attemptCount: receipt.attemptCount + 1,
        updatedAt: input.now,
        processingLeaseId: input.leaseId,
        processingLeaseExpiresAt: input.now + input.leaseDurationMs
    };
}

export function completeProcessingReceipt(
    receipt: CommercialCommandReceipt,
    input: ReceiptCompletionInput,
    resultChecksum: string
): CommercialCommandReceipt {
    const base = {
        ...receipt,
        status: input.result.status,
        updatedAt: input.now,
        resultChecksum,
        ...(input.result.safeResultSummary
            ? { safeResultSummary: input.result.safeResultSummary }
            : {})
    } satisfies CommercialCommandReceipt;

    delete base.processingLeaseId;
    delete base.processingLeaseExpiresAt;

    if (input.result.status === "accepted") {
        return {
            ...base,
            acceptedAt: input.now,
            ...(input.result.publicationId
                ? { publicationId: input.result.publicationId }
                : {})
        };
    }

    if (input.result.status === "rejected") {
        return {
            ...base,
            safeErrorCode: input.result.errorCode,
            rejectedAt: input.now
        };
    }

    return {
        ...base,
        safeErrorCode: input.result.errorCode,
        conflictedAt: input.now
    };
}
