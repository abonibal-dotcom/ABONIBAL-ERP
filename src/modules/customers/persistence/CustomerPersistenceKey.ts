const CUSTOMER_STORAGE_KEY_PREFIX = "customers:";

export function customerStorageKeyForAccount(accountId: string): string {

    const normalizedAccountId = accountId.trim();

    if (!normalizedAccountId) {
        throw new Error("Customer accountId is required.");
    }

    return `${CUSTOMER_STORAGE_KEY_PREFIX}${normalizedAccountId}`;

}
