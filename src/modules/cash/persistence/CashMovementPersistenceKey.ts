const CASH_MOVEMENT_STORAGE_KEY_PREFIX = "cashMovements:";

export function cashMovementStorageKeyForAccount(accountId: string): string {

    const normalizedAccountId = accountId.trim();

    if (!normalizedAccountId) {
        throw new Error("Cash movement accountId is required.");
    }

    return `${CASH_MOVEMENT_STORAGE_KEY_PREFIX}${normalizedAccountId}`;

}
