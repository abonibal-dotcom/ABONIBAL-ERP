const STOCK_MOVEMENT_STORAGE_KEY_PREFIX = "stockMovements:";

export function stockMovementStorageKeyForAccount(accountId: string): string {

    const normalizedAccountId = accountId.trim();

    if (!normalizedAccountId) {
        throw new Error("Stock movement accountId is required.");
    }

    return `${STOCK_MOVEMENT_STORAGE_KEY_PREFIX}${normalizedAccountId}`;

}
