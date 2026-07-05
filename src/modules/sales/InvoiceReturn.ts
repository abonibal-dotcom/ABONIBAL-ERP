import type { InvoiceReturnStatus } from "./InvoiceReturnStatus";

export interface InvoiceReturn {

    id: string;
    accountId: string;
    returnNumber: string;
    invoiceId: string;
    invoiceNumberSnapshot: string;
    status: InvoiceReturnStatus;
    reason: string;
    notes?: string;
    lines: InvoiceReturnLine[];
    total: number;
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
    voidedAt?: string;
    voidedBy?: string;
    voidReason?: string;

}

export interface InvoiceReturnLine {

    id: string;
    invoiceLineId: string;
    productId: string;
    productNameSnapshot: string;
    quantity: number;
    unitPriceSnapshot: number;
    lineTotalSnapshot: number;
    returnQuantity: number;
    originalSaleDeductionMovementId?: string | null;
    returnStockMovementId?: string | null;

}

export interface InvoiceReturnLineInput {

    invoiceLineId: string;
    returnQuantity: number;

}

export interface InvoiceReturnInput {

    invoiceId: string;
    reason: string;
    notes?: string;
    lines: InvoiceReturnLineInput[];

}
