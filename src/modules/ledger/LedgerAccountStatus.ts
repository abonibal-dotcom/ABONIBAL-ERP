export const ledgerAccountStatuses = ["active", "inactive"] as const;

export type LedgerAccountStatus = typeof ledgerAccountStatuses[number];

export function isLedgerAccountStatus(
    value: unknown
): value is LedgerAccountStatus {

    return typeof value === "string"
        && ledgerAccountStatuses.includes(value as LedgerAccountStatus);

}
