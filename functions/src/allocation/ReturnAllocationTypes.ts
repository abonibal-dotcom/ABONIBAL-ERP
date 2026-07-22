export const RETURN_ALLOCATION_SCHEMA_VERSION = 1 as const;

export type ReturnAllocationLineRequest = {
    returnLineId: string;
    invoiceLineId: string;
    quantity: number;
};

export type ReserveReturnAllocationRequest = {
    schemaVersion: typeof RETURN_ALLOCATION_SCHEMA_VERSION;
    accountId: string;
    commandId: string;
    commandType: "invoiceReturn.execute";
    returnId: string;
    invoiceId: string;
    expectedReturnRevision: number;
    expectedReturnChecksum: string;
    requestChecksum: string;
    lines: ReturnAllocationLineRequest[];
};

export type CanonicalInvoiceLine = {
    id: string;
    soldQuantity: number;
};

export type CanonicalInvoice = {
    id: string;
    accountId: string;
    status: "draft" | "issued" | "cancelled";
    revision: number;
    recordChecksum: string;
    lines: CanonicalInvoiceLine[];
};

export type CanonicalInvoiceReturnLine = {
    id: string;
    invoiceLineId: string;
    returnQuantity: number;
};

export type CanonicalInvoiceReturn = {
    id: string;
    accountId: string;
    invoiceId: string;
    status: "recorded" | "executed";
    revision: number;
    recordChecksum: string;
    lines: CanonicalInvoiceReturnLine[];
};

export type ReturnAllocationLineAggregate = {
    invoiceLineId: string;
    soldQuantity: number;
    reservedReturnedQuantity: number;
    committedReturnedQuantity: number;
};

export type ReturnAllocationReservationLine = {
    returnLineId: string;
    invoiceLineId: string;
    quantity: number;
};

export type ReturnAllocationReservation = {
    schemaVersion: typeof RETURN_ALLOCATION_SCHEMA_VERSION;
    accountId: string;
    invoiceId: string;
    returnId: string;
    commandId: string;
    commandType: "invoiceReturn.execute";
    requestChecksum: string;
    sourceReturnRevision: number;
    sourceReturnChecksum: string;
    status: "processing";
    allocations: Record<string, ReturnAllocationReservationLine>;
    createdAt: number;
    updatedAt: number;
};

export type ReturnAllocationState = {
    schemaVersion: typeof RETURN_ALLOCATION_SCHEMA_VERSION;
    accountId: string;
    invoiceId: string;
    revision: number;
    lines: Record<string, ReturnAllocationLineAggregate>;
    reservations: Record<string, ReturnAllocationReservation>;
};

export type ReturnAllocationRejectionCode =
    | "INVALID_REQUEST"
    | "MISSING_CLOUD_BASELINE"
    | "INVOICE_NOT_ISSUED"
    | "RETURN_NOT_RECORDED"
    | "RETURN_ALLOCATION_EXCEEDED";

export type ReturnAllocationConflictCode =
    | "CANONICAL_RECORD_CONFLICT"
    | "RETURN_REVISION_CONFLICT"
    | "RETURN_CHECKSUM_CONFLICT"
    | "RETURN_PAYLOAD_CONFLICT"
    | "ALLOCATION_REQUEST_CONFLICT"
    | "ALLOCATION_STATE_CONFLICT";

export type ReserveReturnAllocationResult =
    | {
        kind: "reserved" | "exactMatch";
        allocationRevision: number;
        reservation: ReturnAllocationReservation;
    }
    | {
        kind: "rejected";
        code: ReturnAllocationRejectionCode;
    }
    | {
        kind: "conflict";
        code: ReturnAllocationConflictCode;
    };

export type ReturnAllocationTransactionInput = {
    request: ReserveReturnAllocationRequest;
    invoiceLines: CanonicalInvoiceLine[];
    now: number;
};
