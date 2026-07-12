export const cashMovementStatuses = ["draft", "posted", "reversed"] as const;

export type CashMovementStatus = typeof cashMovementStatuses[number];

export function isCashMovementStatus(
    value: unknown
): value is CashMovementStatus {

    return typeof value === "string"
        && cashMovementStatuses.includes(value as CashMovementStatus);

}
