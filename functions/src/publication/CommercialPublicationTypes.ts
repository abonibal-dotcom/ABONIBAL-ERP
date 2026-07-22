import type { JsonObject } from "../trusted/CanonicalJson.js";
import type {
    CommercialCommandReceipt
} from "../trusted/CommercialCommandTypes.js";
import type { ReturnAllocationCommit } from "../allocation/ReturnAllocationTypes.js";

export const COMMERCIAL_PUBLICATION_SCHEMA_VERSION = 1 as const;

export interface CanonicalDocumentNumberProof {
    schemaVersion: 1;
    allocationId: string;
    accountId: string;
    documentType: "invoiceReturn";
    targetId: string;
    documentNumber: string;
    businessDate: string;
    timezone: string;
    allocationChecksum: string;
}

export interface CommercialCloudEnvelope {
    data: JsonObject;
    meta: JsonObject;
}

export interface CommercialMovementDescriptor {
    movementId: string;
    returnLineId: string;
    invoiceLineId: string;
    recordChecksum: string;
}

export interface CommercialGroupCommitMarker {
    schemaVersion: typeof COMMERCIAL_PUBLICATION_SCHEMA_VERSION;
    accountId: string;
    publicationId: string;
    commandId: string;
    commandType: "invoiceReturn.execute";
    targetId: string;
    requestChecksum: string;
    publicationChecksum: string;
    allocationCommitChecksum: string;
    allocationInvoiceId: string;
    invoiceReturnChecksum: string;
    invoiceReturnRevision: number;
    movementMembers: Record<string, CommercialMovementDescriptor>;
    receiptResultChecksum: string;
    documentNumberAllocationId: string;
    documentNumberProofChecksum: string;
    status: "committed";
    committedAt: number;
}

export interface AtomicCommercialPublicationPlan {
    accountId: string;
    publicationId: string;
    commandId: string;
    invoiceId: string;
    returnId: string;
    requestChecksum: string;
    processingLeaseId: string;
    recordedReturnEnvelope: CommercialCloudEnvelope;
    executedReturnEnvelope: CommercialCloudEnvelope;
    movementEnvelopes: Record<string, CommercialCloudEnvelope>;
    expectedProcessingReceipt: CommercialCommandReceipt;
    acceptedReceipt: CommercialCommandReceipt;
    allocationCommit: ReturnAllocationCommit;
    marker: CommercialGroupCommitMarker;
}

export type AtomicCommercialPublicationResult =
    | {
        kind: "published" | "exactMatch";
        publicationId: string;
        movementCount: number;
    }
    | {
        kind: "conflict";
        code:
            | "ALLOCATION_COMMIT_CONFLICT"
            | "RETURN_BASELINE_CONFLICT"
            | "RECEIPT_STATE_CONFLICT"
            | "MOVEMENT_ID_CONFLICT"
            | "PUBLICATION_MARKER_CONFLICT"
            | "PARTIAL_PUBLICATION_STATE_CONFLICT";
    };

export interface ExecuteReturnPublicationRequest {
    schemaVersion: 1;
    accountId: string;
    commandId: string;
    commandType: "invoiceReturn.execute";
    returnId: string;
    invoiceId: string;
    requestChecksum: string;
    reservationChecksum: string;
    recordedReturnEnvelope: CommercialCloudEnvelope;
    processingReceipt: CommercialCommandReceipt;
    documentNumberProof: CanonicalDocumentNumberProof;
    actorId: string;
}

export type ExecuteReturnPublicationResult =
    | AtomicCommercialPublicationResult
    | {
        kind: "rejected";
        code: "INVALID_PUBLICATION_REQUEST" | "DOCUMENT_NUMBER_PROOF_REQUIRED";
    }
    | {
        kind: "conflict";
        code:
            | "ALLOCATION_COMMIT_CONFLICT"
            | "RETURN_BASELINE_CONFLICT"
            | "RECEIPT_STATE_CONFLICT"
            | "MOVEMENT_ID_CONFLICT"
            | "PUBLICATION_MARKER_CONFLICT"
            | "PARTIAL_PUBLICATION_STATE_CONFLICT"
            | "ALLOCATION_STATE_CONFLICT"
            | "RESERVATION_CHECKSUM_CONFLICT";
    };
