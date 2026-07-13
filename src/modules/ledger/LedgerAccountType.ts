export const ledgerAccountTypes = [
    "asset",
    "liability",
    "equity",
    "revenue",
    "expense"
] as const;

export type LedgerAccountType = typeof ledgerAccountTypes[number];

export function isLedgerAccountType(value: unknown): value is LedgerAccountType {

    return typeof value === "string"
        && ledgerAccountTypes.includes(value as LedgerAccountType);

}

export function isDebitNormalLedgerAccountType(
    type: LedgerAccountType
): boolean {

    return type === "asset" || type === "expense";

}
