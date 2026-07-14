export const syncModes = [
    "disabled",
    "migration",
    "active"
] as const;

export type SyncMode = typeof syncModes[number];

export const DEFAULT_SYNC_MODE: SyncMode = "disabled";

export interface MigrationModeApproval {
    ownerApproved: true;
    migrationId: string;
}

export interface ActiveModeApproval {
    ownerApproved: true;
    migrationVerified: true;
    cutoverApproved: true;
    approvalReference: string;
}

export function isSyncMode(value: unknown): value is SyncMode {
    return typeof value === "string"
        && syncModes.some(mode => mode === value);
}
