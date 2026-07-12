const SUPPLIER_STORAGE_KEY_PREFIX = "suppliers:";

export function supplierStorageKeyForAccount(accountId: string): string {

    const normalizedAccountId = accountId.trim();

    if (!normalizedAccountId) {
        throw new Error("Supplier accountId is required.");
    }

    return `${SUPPLIER_STORAGE_KEY_PREFIX}${normalizedAccountId}`;

}
