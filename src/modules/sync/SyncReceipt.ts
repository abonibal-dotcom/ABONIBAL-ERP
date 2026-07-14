import type { SyncModule } from "./SyncOperation";

export const syncReceiptResults = [
    "created",
    "updated",
    "appended",
    "voided",
    "reversed",
    "duplicate_acknowledged"
] as const;

export type SyncReceiptResult = typeof syncReceiptResults[number];

export interface SyncReceipt {
    operationId: string;
    accountId: string;
    module: SyncModule;
    recordId: string;
    idempotencyKey: string;
    result: SyncReceiptResult;
    acknowledgedAt: string;
    cloudRevision?: number;
    cloudChecksum?: string;
}

export function isSyncReceiptResult(
    value: unknown
): value is SyncReceiptResult {
    return typeof value === "string"
        && syncReceiptResults.some(result => result === value);
}
