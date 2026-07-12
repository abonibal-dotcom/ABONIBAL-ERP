import type { PurchaseStatus } from "./PurchaseStatus";

export interface Purchase {

    id: string;
    accountId: string;
    purchaseNumber: string;
    status: PurchaseStatus;
    supplierId?: string;
    supplierSnapshot: Record<string, unknown> | null;
    lines: PurchaseLine[];
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    notes?: string;
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
    postedAt?: string;
    postedBy?: string;
    cancelledAt?: string;
    cancelledBy?: string;
    cancelReason?: string;

}

export interface PurchaseLine {

    id: string;
    productId?: string;
    productNameSnapshot: string;
    skuSnapshot?: string;
    barcodeSnapshot?: string;
    unitSnapshot?: string;
    quantity: number;
    unitCost: number;
    discount: number;
    tax: number;
    lineSubtotal: number;
    lineTotal: number;

}

export interface PurchaseDraftInput {

    purchaseNumber?: string;
    supplierId?: string;
    supplierSnapshot?: Record<string, unknown> | null;
    lines: PurchaseDraftLineInput[];
    discount?: number;
    tax?: number;
    notes?: string;

}

export interface PurchaseDraftLineInput {

    productId?: string;
    productNameSnapshot: string;
    skuSnapshot?: string;
    barcodeSnapshot?: string;
    unitSnapshot?: string;
    quantity: number;
    unitCost: number;
    discount?: number;
    tax?: number;

}

export interface PurchaseDraftUpdateInput {

    purchaseNumber?: string;
    supplierId?: string;
    supplierSnapshot?: Record<string, unknown> | null;
    lines?: PurchaseDraftLineInput[];
    discount?: number;
    tax?: number;
    notes?: string;

}
