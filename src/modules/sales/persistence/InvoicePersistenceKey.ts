const INVOICE_STORAGE_KEY_PREFIX = "invoices:";

export function invoiceStorageKeyForAccount(accountId: string): string {

    const normalizedAccountId = accountId.trim();

    if (!normalizedAccountId) {
        throw new Error("Invoice accountId is required.");
    }

    return `${INVOICE_STORAGE_KEY_PREFIX}${normalizedAccountId}`;

}

