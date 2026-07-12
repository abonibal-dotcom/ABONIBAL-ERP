const PAYMENT_STORAGE_KEY_PREFIX = "payments:";

export function paymentStorageKeyForAccount(accountId: string): string {

    const normalizedAccountId = accountId.trim();

    if (!normalizedAccountId) {
        throw new Error("Payment accountId is required.");
    }

    return `${PAYMENT_STORAGE_KEY_PREFIX}${normalizedAccountId}`;

}
