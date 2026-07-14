import { DEFAULT_SYNC_MODE } from "../SyncMode";
import type { SyncStatus } from "../SyncStatus";

export type SyncStatusSubscriber = (status: SyncStatus) => void;

export class SyncStatusService {
    private status: SyncStatus = {
        mode: DEFAULT_SYNC_MODE,
        state: "disabled",
        pendingCount: 0,
        conflictCount: 0,
        failedCount: 0,
        pendingLocalApplyCount: 0,
        localApplyConflictCount: 0,
        localApplyFailedCount: 0,
        connectivity: "unknown",
        accountResolved: false
    };

    private readonly subscribers = new Set<SyncStatusSubscriber>();

    public getStatus(): SyncStatus {
        return { ...this.status };
    }

    public update(patch: Partial<SyncStatus>): SyncStatus {
        const next = {
            ...this.status,
            ...patch
        };

        validateCount(next.pendingCount, "pendingCount");
        validateCount(next.conflictCount, "conflictCount");
        validateCount(next.failedCount, "failedCount");
        validateCount(next.pendingLocalApplyCount, "pendingLocalApplyCount");
        validateCount(next.localApplyConflictCount, "localApplyConflictCount");
        validateCount(next.localApplyFailedCount, "localApplyFailedCount");

        this.status = next;
        this.notify();

        return this.getStatus();
    }

    public subscribe(subscriber: SyncStatusSubscriber): () => void {
        this.subscribers.add(subscriber);

        return () => {
            this.subscribers.delete(subscriber);
        };
    }

    private notify(): void {
        const snapshot = this.getStatus();

        for (const subscriber of this.subscribers) {
            try {
                subscriber(snapshot);
            } catch {
                // A support-status observer cannot interrupt synchronization.
            }
        }
    }
}

function validateCount(value: number, field: string): void {
    if (!Number.isInteger(value) || value < 0) {
        throw new Error(`Sync status ${field} must be a non-negative integer.`);
    }
}
