import type { InvoiceStatus } from "./InvoiceStatus";

export interface Invoice {

    id: string;
    accountId: string;
    invoiceNumber: string;
    status: InvoiceStatus;
    revision?: number;
    issueCommandId?: string;
    cancellationCommandId?: string;
    customerId?: string;
    customerSnapshot: Record<string, unknown> | null;
    lines: InvoiceLine[];
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    notes?: string;
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
    issuedAt?: string;
    issuedBy?: string;
    cancelledAt?: string;
    cancelledBy?: string;
    cancelReason?: string;

}

export interface InvoiceLine {

    id: string;
    productId: string;
    productNameSnapshot: string;
    skuSnapshot?: string;
    barcodeSnapshot?: string;
    unitSnapshot?: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    tax: number;
    lineSubtotal: number;
    lineTotal: number;
    stockMovementId?: string | null;
    reversalStockMovementId?: string | null;

}

export interface InvoiceDraftInput {

    customerId?: string;
    customerSnapshot?: Record<string, unknown> | null;
    lines: InvoiceDraftLineInput[];
    discount?: number;
    tax?: number;
    notes?: string;

}

export interface InvoiceDraftLineInput {

    id?: string;
    productId: string;
    productNameSnapshot: string;
    skuSnapshot?: string;
    barcodeSnapshot?: string;
    unitSnapshot?: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    tax?: number;

}

export interface InvoiceDraftUpdateInput {

    customerId?: string;
    customerSnapshot?: Record<string, unknown> | null;
    lines?: InvoiceDraftLineInput[];
    discount?: number;
    tax?: number;
    notes?: string;

}
