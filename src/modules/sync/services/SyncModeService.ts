import {
    DEFAULT_SYNC_MODE,
    type ActiveModeApproval,
    type MigrationModeApproval,
    type SyncMode
} from "../SyncMode";

export type SyncModeSubscriber = (mode: SyncMode) => void;

export class SyncModeService {
    private mode: SyncMode = DEFAULT_SYNC_MODE;

    private readonly subscribers = new Set<SyncModeSubscriber>();

    public getMode(): SyncMode {
        return this.mode;
    }

    public enterMigration(approval: MigrationModeApproval): SyncMode {
        if (approval.ownerApproved !== true || !approval.migrationId.trim()) {
            throw new Error("Migration mode requires explicit owner approval and migration ID.");
        }

        return this.setMode("migration");
    }

    public activate(approval: ActiveModeApproval): SyncMode {
        if (
            approval.ownerApproved !== true
            || approval.migrationVerified !== true
            || approval.cutoverApproved !== true
            || !approval.approvalReference.trim()
        ) {
            throw new Error("Active sync requires verified migration and explicit owner cutover approval.");
        }

        return this.setMode("active");
    }

    public disable(): SyncMode {
        return this.setMode("disabled");
    }

    public subscribe(subscriber: SyncModeSubscriber): () => void {
        this.subscribers.add(subscriber);

        return () => {
            this.subscribers.delete(subscriber);
        };
    }

    private setMode(mode: SyncMode): SyncMode {
        this.mode = mode;

        for (const subscriber of this.subscribers) {
            try {
                subscriber(mode);
            } catch {
                // A status observer cannot change or roll back the mode gate.
            }
        }

        return this.mode;
    }
}
