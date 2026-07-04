export const stockMovementTypes = [
    "opening_balance",
    "manual_adjustment",
    "purchase_receipt",
    "sale_deduction",
    "sale_return",
    "purchase_return",
    "correction",
    "void",
] as const;

export type StockMovementType = typeof stockMovementTypes[number];

export const stockMovementReferenceTypes = [
    "manual",
    "opening_balance",
    "invoice",
    "invoice_return",
    "purchase",
    "purchase_return",
    "correction",
    "void",
] as const;

export type StockMovementReferenceType =
    typeof stockMovementReferenceTypes[number];

export function isStockMovementType(
    value: unknown
): value is StockMovementType {

    return typeof value === "string"
        && stockMovementTypes.includes(value as StockMovementType);

}

export function isStockMovementReferenceType(
    value: unknown
): value is StockMovementReferenceType {

    return typeof value === "string"
        && stockMovementReferenceTypes.includes(
            value as StockMovementReferenceType
        );

}
