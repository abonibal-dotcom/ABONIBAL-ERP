const PRODUCT_STORAGE_KEY_PREFIX = "products:";

export function productStorageKeyForAccount(accountId: string): string {

    const normalizedAccountId = accountId.trim();

    if (!normalizedAccountId) {
        throw new Error("Product accountId is required.");
    }

    return `${PRODUCT_STORAGE_KEY_PREFIX}${normalizedAccountId}`;

}
