import type { JsonObject } from "./CanonicalJson.js";

export const COMMERCIAL_COMMAND_SCHEMA_VERSION = 1 as const;

export type CommercialCommandRequest = {
    schemaVersion: typeof COMMERCIAL_COMMAND_SCHEMA_VERSION;
    accountId: string;
    commandId: string;
    commandType: string;
    targetId: string;
    payload: JsonObject;
    clientRequestChecksum?: string;
};

export type CommercialCommandReceiptStatus =
    | "processing"
    | "accepted"
    | "rejected"
    | "conflict";

export type CommercialCommandReceipt = {
    schemaVersion: typeof COMMERCIAL_COMMAND_SCHEMA_VERSION;
    accountId: string;
    commandId: string;
    commandType: string;
    targetId: string;
    requestChecksum: string;
    status: CommercialCommandReceiptStatus;
    attemptCount: number;
    createdAt: number;
    updatedAt: number;
    processingLeaseId?: string;
    processingLeaseExpiresAt?: number;
    resultChecksum?: string;
    safeResultSummary?: JsonObject;
    safeErrorCode?: string;
    publicationId?: string;
    acceptedAt?: number;
    rejectedAt?: number;
    conflictedAt?: number;
};

export type SafeCommercialCommandReceipt = Omit<
    CommercialCommandReceipt,
    "processingLeaseId" | "processingLeaseExpiresAt"
> & {
    processingLeaseExpiresAt?: number;
};

export type TrustedCommandHandlerResult =
    | {
        status: "accepted";
        safeResultSummary: JsonObject;
        publicationId?: string;
    }
    | {
        status: "rejected";
        errorCode: string;
        safeResultSummary?: JsonObject;
    }
    | {
        status: "conflict";
        errorCode: string;
        safeResultSummary?: JsonObject;
    };

export type TrustedCommandHandler = (
    request: CommercialCommandRequest
) => Promise<TrustedCommandHandlerResult>;

export type ReceiptLookupRequest = {
    accountId: string;
    commandId: string;
};

export type ReceiptLookupResponse =
    | { found: false }
    | { found: true; receipt: SafeCommercialCommandReceipt };
