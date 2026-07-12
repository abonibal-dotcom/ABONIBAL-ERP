const EXPENSE_STORAGE_KEY_PREFIX = "expenses:";

export function expenseStorageKeyForAccount(accountId: string): string {

    const normalizedAccountId = accountId.trim();

    if (!normalizedAccountId) {
        throw new Error("Expense accountId is required.");
    }

    return `${EXPENSE_STORAGE_KEY_PREFIX}${normalizedAccountId}`;

}
