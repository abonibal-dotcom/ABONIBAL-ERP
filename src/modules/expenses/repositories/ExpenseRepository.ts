import type { Driver } from "../../../core/persistence/Driver";
import { Repository } from "../../../core/repositories/Repository";
import type { Expense } from "../Expense";
import { isExpensePayeeType } from "../ExpensePayeeType";
import { isExpensePaymentMethod } from "../ExpensePaymentMethod";
import { isExpenseStatus } from "../ExpenseStatus";
import { expenseStorageKeyForAccount } from "../persistence/ExpensePersistenceKey";

export class ExpenseRepository extends Repository<Expense> {

    public constructor(driver: Driver) {

        super("expenses", driver);

    }

    public allForAccount(accountId: string): Expense[] {

        const normalizedAccountId = accountId.trim();
        const storedExpenses = this.driver.read<unknown[]>(
            expenseStorageKeyForAccount(normalizedAccountId)
        );

        if (!Array.isArray(storedExpenses)) {
            return [];
        }

        return storedExpenses
            .filter(isExpense)
            .filter(expense => expense.accountId === normalizedAccountId);

    }

    public appendForAccount(accountId: string, expense: Expense): void {

        const expenses = this.allForAccount(accountId);

        expenses.push(expense);
        this.saveForAccount(accountId, expenses);

    }

    public findForAccount(
        accountId: string,
        expenseId: string
    ): Expense | undefined {

        return this
            .allForAccount(accountId)
            .find(expense => expense.id === expenseId);

    }

    public updateForAccount(
        accountId: string,
        expenseId: string,
        expense: Expense
    ): Expense | null {

        const expenses = this.allForAccount(accountId);
        const expenseIndex = expenses.findIndex(
            currentExpense => currentExpense.id === expenseId
        );

        if (expenseIndex === -1) {
            return null;
        }

        expenses[expenseIndex] = expense;
        this.saveForAccount(accountId, expenses);

        return expense;

    }

    private saveForAccount(accountId: string, expenses: Expense[]): void {

        this.driver.write<Expense[]>(
            expenseStorageKeyForAccount(accountId),
            expenses
        );

    }

}

function isExpense(value: unknown): value is Expense {

    if (!value || typeof value !== "object") {
        return false;
    }

    const expense = value as Partial<Expense>;

    return isNonEmptyString(expense.id)
        && isNonEmptyString(expense.accountId)
        && isNonEmptyString(expense.expenseNumber)
        && isExpenseStatus(expense.status)
        && isNonEmptyString(expense.expenseDate)
        && isDisplaySnapshot(expense.categorySnapshot)
        && isExpensePayeeType(expense.payeeType)
        && isNullableDisplaySnapshot(expense.payeeSnapshot)
        && isFiniteNumber(expense.amount)
        && isExpensePaymentMethod(expense.paymentMethod)
        && isNonEmptyString(expense.createdAt)
        && isNonEmptyString(expense.createdBy)
        && isNonEmptyString(expense.updatedAt)
        && isNonEmptyString(expense.updatedBy);

}

function isDisplaySnapshot(
    value: unknown
): value is { displayName: string } {

    return Boolean(value)
        && typeof value === "object"
        && !Array.isArray(value)
        && isNonEmptyString((value as { displayName?: unknown }).displayName);

}

function isNullableDisplaySnapshot(
    value: unknown
): value is { displayName: string } | null {

    return value === null || isDisplaySnapshot(value);

}

function isNonEmptyString(value: unknown): value is string {

    return typeof value === "string" && value.trim().length > 0;

}

function isFiniteNumber(value: unknown): value is number {

    return typeof value === "number" && Number.isFinite(value);

}
