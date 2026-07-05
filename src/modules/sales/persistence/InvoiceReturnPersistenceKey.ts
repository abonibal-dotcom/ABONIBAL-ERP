const INVOICE_RETURN_STORAGE_KEY_PREFIX = "invoiceReturns:";

export function invoiceReturnStorageKeyForAccount(accountId: string): string {

    const normalizedAccountId = accountId.trim();

    if (!normalizedAccountId) {
        throw new Error("Invoice return storage accountId is required.");
    }

    return `${INVOICE_RETURN_STORAGE_KEY_PREFIX}${normalizedAccountId}`;

}
