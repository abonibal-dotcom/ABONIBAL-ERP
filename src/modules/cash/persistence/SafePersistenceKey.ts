const SAFE_STORAGE_KEY_PREFIX = "safes:";

export function safeStorageKeyForAccount(accountId: string): string {

    const normalizedAccountId = accountId.trim();

    if (!normalizedAccountId) {
        throw new Error("Safe accountId is required.");
    }

    return `${SAFE_STORAGE_KEY_PREFIX}${normalizedAccountId}`;

}
