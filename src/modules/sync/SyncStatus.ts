import type { SyncMode } from "./SyncMode";

export const syncStates = [
    "disabled",
    "idle",
    "syncing",
    "offline",
    "conflict",
    "error",
    "paused",
    "stopped"
] as const;

export type SyncState = typeof syncStates[number];

export const syncConnectivityStates = [
    "unknown",
    "online",
    "offline"
] as const;

export type SyncConnectivity = typeof syncConnectivityStates[number];

export interface SyncStatus {
    mode: SyncMode;
    state: SyncState;
    pendingCount: number;
    conflictCount: number;
    failedCount: number;
    pendingLocalApplyCount: number;
    localApplyConflictCount: number;
    localApplyFailedCount: number;
    lastSuccessfulSyncAt?: string;
    lastErrorSafe?: string;
    connectivity: SyncConnectivity;
    accountResolved: boolean;
}
