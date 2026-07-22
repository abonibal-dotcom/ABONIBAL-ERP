import type {
    CanonicalInvoice,
    CanonicalInvoiceReturn
} from "./ReturnAllocationTypes.js";

export interface CanonicalCommercialRecordReader {
    findInvoice(accountId: string, invoiceId: string): Promise<CanonicalInvoice | null>;
    findInvoiceReturn(
        accountId: string,
        returnId: string
    ): Promise<CanonicalInvoiceReturn | null>;
}

export class CanonicalRecordStateError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CanonicalRecordStateError";
    }
}
