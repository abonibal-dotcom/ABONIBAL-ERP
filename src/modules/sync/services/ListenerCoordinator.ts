export type SyncUnsubscribe = () => void;

export class ListenerCoordinator {
    private readonly subscriptions = new Map<string, SyncUnsubscribe>();

    public register(key: string, unsubscribe: SyncUnsubscribe): void {
        const normalizedKey = normalizeKey(key);
        const existing = this.subscriptions.get(normalizedKey);

        if (existing) {
            existing();
        }

        this.subscriptions.set(normalizedKey, unsubscribe);
    }

    public unsubscribe(key: string): void {
        const normalizedKey = normalizeKey(key);
        const existing = this.subscriptions.get(normalizedKey);

        if (!existing) {
            return;
        }

        existing();
        this.subscriptions.delete(normalizedKey);
    }

    public unsubscribeAll(): void {
        for (const unsubscribe of this.subscriptions.values()) {
            try {
                unsubscribe();
            } catch {
                // Cleanup continues so no stale account listeners remain.
            }
        }

        this.subscriptions.clear();
    }

    public count(): number {
        return this.subscriptions.size;
    }
}

function normalizeKey(key: string): string {
    const normalized = key.trim();

    if (!normalized) {
        throw new Error("Sync listener key is required.");
    }

    return normalized;
}
