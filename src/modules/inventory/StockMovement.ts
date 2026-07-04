import type {
    StockMovementReferenceType,
    StockMovementType
} from "./StockMovementType";

export interface StockMovement {

    id: string;
    accountId: string;
    productId: string;
    type: StockMovementType;
    quantityDelta: number;
    reason: string;
    referenceType: StockMovementReferenceType;
    referenceId?: string;
    unitCost?: number;
    totalCost?: number;
    createdAt: string;
    createdBy: string;
    updatedAt?: string;
    updatedBy?: string;
    voidedAt?: string;
    voidedBy?: string;
    voidReason?: string;
    metadata?: Record<string, unknown>;

}

export interface StockMovementInput {

    productId: string;
    type: StockMovementType;
    quantityDelta: number;
    reason: string;
    referenceType: StockMovementReferenceType;
    referenceId?: string;
    unitCost?: number;
    totalCost?: number;
    metadata?: Record<string, unknown>;

}
