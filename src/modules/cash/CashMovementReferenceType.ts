export const cashMovementReferenceTypes = [
    "manual",
    "opening_balance",
    "payment",
    "expense",
    "sale",
    "purchase",
    "transfer",
    "adjustment",
    "reversal",
    "other"
] as const;

export type CashMovementReferenceType =
    typeof cashMovementReferenceTypes[number];

export function isCashMovementReferenceType(
    value: unknown
): value is CashMovementReferenceType {

    return typeof value === "string"
        && cashMovementReferenceTypes.includes(
            value as CashMovementReferenceType
        );

}
