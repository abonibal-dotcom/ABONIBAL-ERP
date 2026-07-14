const SYNC_OUTBOX_PREFIX = "syncOutbox:";
const SYNC_RECEIPTS_PREFIX = "syncReceipts:";
const SYNC_CONFLICTS_PREFIX = "syncConflicts:";

export function syncOutboxKeyForAccount(accountId: string): string {
    return `${SYNC_OUTBOX_PREFIX}${normalizeAccountId(accountId)}`;
}

export function syncReceiptsKeyForAccount(accountId: string): string {
    return `${SYNC_RECEIPTS_PREFIX}${normalizeAccountId(accountId)}`;
}

export function syncConflictsKeyForAccount(accountId: string): string {
    return `${SYNC_CONFLICTS_PREFIX}${normalizeAccountId(accountId)}`;
}

function normalizeAccountId(accountId: string): string {
    const normalized = accountId.trim();

    if (!normalized) {
        throw new Error("Sync accountId is required.");
    }

    return normalized;
}
