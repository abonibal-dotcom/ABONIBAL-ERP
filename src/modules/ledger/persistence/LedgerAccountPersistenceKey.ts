const LEDGER_ACCOUNT_STORAGE_KEY_PREFIX = "ledgerAccounts:";

export function ledgerAccountStorageKeyForAccount(accountId: string): string {

    const normalizedAccountId = accountId.trim();

    if (!normalizedAccountId) {
        throw new Error("Ledger account accountId is required.");
    }

    return `${LEDGER_ACCOUNT_STORAGE_KEY_PREFIX}${normalizedAccountId}`;

}
