import type {
    StockMovementReferenceType,
    StockMovementType
} from "./StockMovementType";

export const IMMUTABLE_STOCK_MOVEMENT_SEMANTICS_VERSION = 2 as const;

export interface StockMovementReversalIdentity {

    movementId: string;
    idempotencyKey: string;

}

export interface ProductOpeningStockMovementIdentity {

    movementId: string;
    idempotencyKey: string;

}

export interface StockMovementCreateIdentity {

    movementId: string;
    idempotencyKey: string;

}

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
    ledgerSemanticsVersion?: typeof IMMUTABLE_STOCK_MOVEMENT_SEMANTICS_VERSION;
    reversalOfMovementId?: string;
    reversalReason?: string;
    idempotencyKey?: string;
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

export function buildStockMovementReversalIdentity(
    originalMovementId: string
): StockMovementReversalIdentity | null {

    const normalizedMovementId = originalMovementId.trim();

    if (!/^[A-Za-z0-9_-]+$/.test(normalizedMovementId)) {
        return null;
    }

    return {
        movementId: `reversal-${normalizedMovementId}`,
        idempotencyKey: `stockMovement:reverse:${normalizedMovementId}`
    };

}

export function buildProductOpeningStockMovementIdentity(
    productId: string
): ProductOpeningStockMovementIdentity | null {

    const normalizedProductId = productId.trim();

    if (!/^[A-Za-z0-9_-]+$/.test(normalizedProductId)) {
        return null;
    }

    return {
        movementId: `opening-${normalizedProductId}`,
        idempotencyKey: `stockMovement:opening:${normalizedProductId}`
    };

}

export function isLegacyVoidedStockMovement(
    movement: StockMovement
): boolean {

    return movement.ledgerSemanticsVersion !== 2
        && isNonEmptyString(movement.voidedAt);

}

export function isReversalStockMovement(
    movement: StockMovement
): boolean {

    return movement.type === "reversal";

}

export function stockMovementInventoryEffect(
    movement: StockMovement
): number {

    return isLegacyVoidedStockMovement(movement)
        ? 0
        : movement.quantityDelta;

}

function isNonEmptyString(value: unknown): value is string {

    return typeof value === "string" && value.trim().length > 0;

}
