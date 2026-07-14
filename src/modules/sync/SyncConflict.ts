import type { SyncModule } from "./SyncOperation";

export const syncConflictStatuses = [
    "unresolved",
    "resolved",
    "dismissed"
] as const;

export type SyncConflictStatus = typeof syncConflictStatuses[number];

export interface SyncConflict {
    conflictId: string;
    accountId: string;
    operationId: string;
    module: SyncModule;
    recordId: string;
    expectedRevision?: number;
    actualRevision?: number;
    detectedAt: string;
    summarySafe: string;
    status: SyncConflictStatus;
    resolvedAt?: string;
}

export function isSyncConflictStatus(
    value: unknown
): value is SyncConflictStatus {
    return typeof value === "string"
        && syncConflictStatuses.some(status => status === value);
}
