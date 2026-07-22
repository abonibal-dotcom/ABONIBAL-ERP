import {
    CanonicalRecordStateError,
    type CanonicalCommercialRecordReader
} from "./CanonicalCommercialRecordReader.js";
import type { ReturnAllocationRepository } from "./ReturnAllocationRepository.js";
import type {
    CanonicalInvoiceReturnLine,
    ReserveReturnAllocationResult
} from "./ReturnAllocationTypes.js";
import {
    validateReserveReturnAllocationRequest
} from "./ReturnAllocationValidation.js";

export class CanonicalReturnAllocationService {
    constructor(
        private readonly records: CanonicalCommercialRecordReader,
        private readonly allocations: ReturnAllocationRepository,
        private readonly now: () => number = () => Date.now()
    ) {}

    async reserve(value: unknown): Promise<ReserveReturnAllocationResult> {
        let request;
        try {
            request = validateReserveReturnAllocationRequest(value);
        } catch {
            return { kind: "rejected", code: "INVALID_REQUEST" };
        }

        let invoice;
        let invoiceReturn;
        try {
            [invoice, invoiceReturn] = await Promise.all([
                this.records.findInvoice(request.accountId, request.invoiceId),
                this.records.findInvoiceReturn(request.accountId, request.returnId)
            ]);
        } catch (error) {
            if (error instanceof CanonicalRecordStateError) {
                return { kind: "conflict", code: "CANONICAL_RECORD_CONFLICT" };
            }
            throw error;
        }

        if (!invoice || !invoiceReturn) {
            return { kind: "rejected", code: "MISSING_CLOUD_BASELINE" };
        }
        if (
            invoice.accountId !== request.accountId
            || invoice.id !== request.invoiceId
            || invoiceReturn.accountId !== request.accountId
            || invoiceReturn.id !== request.returnId
            || invoiceReturn.invoiceId !== request.invoiceId
        ) {
            return { kind: "conflict", code: "CANONICAL_RECORD_CONFLICT" };
        }
        if (invoice.status !== "issued") {
            return { kind: "rejected", code: "INVOICE_NOT_ISSUED" };
        }
        if (invoiceReturn.status !== "recorded") {
            return { kind: "rejected", code: "RETURN_NOT_RECORDED" };
        }
        if (invoiceReturn.revision !== request.expectedReturnRevision) {
            return { kind: "conflict", code: "RETURN_REVISION_CONFLICT" };
        }
        if (invoiceReturn.recordChecksum !== request.expectedReturnChecksum) {
            return { kind: "conflict", code: "RETURN_CHECKSUM_CONFLICT" };
        }
        if (!sameReturnLines(invoiceReturn.lines, request.lines)) {
            return { kind: "conflict", code: "RETURN_PAYLOAD_CONFLICT" };
        }

        const invoiceLineIds = new Set(invoice.lines.map(line => line.id));
        if (request.lines.some(line => !invoiceLineIds.has(line.invoiceLineId))) {
            return { kind: "conflict", code: "RETURN_PAYLOAD_CONFLICT" };
        }

        return this.allocations.reserve({
            request,
            invoiceLines: invoice.lines,
            now: this.now()
        });
    }
}

function sameReturnLines(
    canonical: CanonicalInvoiceReturnLine[],
    requested: { returnLineId: string; invoiceLineId: string; quantity: number }[]
): boolean {
    if (canonical.length !== requested.length) {
        return false;
    }
    const canonicalById = new Map(canonical.map(line => [line.id, line]));
    return requested.every(line => {
        const current = canonicalById.get(line.returnLineId);
        return current?.invoiceLineId === line.invoiceLineId
            && current.returnQuantity === line.quantity;
    });
}
