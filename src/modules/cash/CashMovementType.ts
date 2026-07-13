export const cashMovementTypes = [
    "opening_balance",
    "cash_in",
    "cash_out",
    "transfer_in",
    "transfer_out",
    "adjustment_in",
    "adjustment_out"
] as const;

export type CashMovementType = typeof cashMovementTypes[number];

export function isCashMovementType(value: unknown): value is CashMovementType {

    return typeof value === "string"
        && cashMovementTypes.includes(value as CashMovementType);

}

export function isCashMovementInflow(type: CashMovementType): boolean {

    return type === "opening_balance"
        || type === "cash_in"
        || type === "transfer_in"
        || type === "adjustment_in";

}

export function isCashMovementTransfer(type: CashMovementType): boolean {

    return type === "transfer_in" || type === "transfer_out";

}

export function oppositeCashMovementType(
    type: CashMovementType
): CashMovementType {

    switch (type) {
        case "opening_balance":
            return "adjustment_out";
        case "cash_in":
            return "cash_out";
        case "cash_out":
            return "cash_in";
        case "transfer_in":
            return "transfer_out";
        case "transfer_out":
            return "transfer_in";
        case "adjustment_in":
            return "adjustment_out";
        case "adjustment_out":
            return "adjustment_in";
    }

}
