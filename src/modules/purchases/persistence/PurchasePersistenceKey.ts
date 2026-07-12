const PURCHASE_STORAGE_KEY_PREFIX = "purchases:";

export function purchaseStorageKeyForAccount(accountId: string): string {

    const normalizedAccountId = accountId.trim();

    if (!normalizedAccountId) {
        throw new Error("Purchase accountId is required.");
    }

    return `${PURCHASE_STORAGE_KEY_PREFIX}${normalizedAccountId}`;

}
