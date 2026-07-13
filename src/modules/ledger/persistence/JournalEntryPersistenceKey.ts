const JOURNAL_ENTRY_STORAGE_KEY_PREFIX = "ledgerEntries:";

export function journalEntryStorageKeyForAccount(accountId: string): string {

    const normalizedAccountId = accountId.trim();

    if (!normalizedAccountId) {
        throw new Error("Journal entry accountId is required.");
    }

    return `${JOURNAL_ENTRY_STORAGE_KEY_PREFIX}${normalizedAccountId}`;

}
