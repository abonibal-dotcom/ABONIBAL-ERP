export const safeStatuses = ["active", "inactive"] as const;

export type SafeStatus = typeof safeStatuses[number];

export function isSafeStatus(value: unknown): value is SafeStatus {

    return typeof value === "string"
        && safeStatuses.includes(value as SafeStatus);

}
