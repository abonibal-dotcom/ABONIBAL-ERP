const PRODUCT_STORAGE_KEY_PREFIX = "products:";
const LEGACY_PRODUCT_STORAGE_KEY = "products";
const PRODUCT_LEGACY_IMPORT_BACKUP_PREFIX = "backup:products:";

export function productStorageKeyForAccount(accountId: string): string {

    const normalizedAccountId = accountId.trim();

    if (!normalizedAccountId) {
        throw new Error("Product accountId is required.");
    }

    return `${PRODUCT_STORAGE_KEY_PREFIX}${normalizedAccountId}`;

}

export function legacyProductStorageKey(): string {

    return LEGACY_PRODUCT_STORAGE_KEY;

}

export function productLegacyImportBackupKeyForAccount(
    accountId: string,
    timestamp: string
): string {

    const normalizedAccountId = accountId.trim();
    const normalizedTimestamp = timestamp.trim();

    if (!normalizedAccountId) {
        throw new Error("Product accountId is required.");
    }

    if (!normalizedTimestamp) {
        throw new Error("Product import backup timestamp is required.");
    }

    return `${PRODUCT_LEGACY_IMPORT_BACKUP_PREFIX}${normalizedAccountId}:legacy-import:${normalizedTimestamp}`;

}
