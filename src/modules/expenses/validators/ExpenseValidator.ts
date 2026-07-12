import type { Expense } from "../Expense";
import { isExpensePayeeType } from "../ExpensePayeeType";
import { isExpensePaymentMethod } from "../ExpensePaymentMethod";
import { isExpenseStatus } from "../ExpenseStatus";

export class ExpenseValidator {

    public validate(expense: Expense): string[] {

        const errors: string[] = [];

        if (!expense.id.trim()) {
            errors.push("Expense id is required.");
        }

        if (!expense.accountId.trim()) {
            errors.push("Expense accountId is required.");
        }

        if (!expense.expenseNumber.trim()) {
            errors.push("Expense number is required.");
        }

        if (!isExpenseStatus(expense.status)) {
            errors.push("Expense status is invalid.");
        }

        if (!isValidExpenseDate(expense.expenseDate)) {
            errors.push("Expense date must use a valid YYYY-MM-DD date.");
        }

        if (!expense.categorySnapshot.displayName.trim()) {
            errors.push("Expense category is required.");
        }

        if (!isExpensePayeeType(expense.payeeType)) {
            errors.push("Expense payeeType is invalid.");
        }

        if (expense.payeeId !== undefined && !expense.payeeId.trim()) {
            errors.push("Expense payeeId cannot be empty when provided.");
        }

        if (
            expense.payeeSnapshot !== null
            && !expense.payeeSnapshot.displayName.trim()
        ) {
            errors.push("Expense payee snapshot displayName is required.");
        }

        if (!Number.isFinite(expense.amount) || expense.amount <= 0) {
            errors.push("Expense amount must be greater than zero.");
        }

        if (!isExpensePaymentMethod(expense.paymentMethod)) {
            errors.push("Expense payment method is invalid.");
        }

        if (!expense.createdAt.trim()) {
            errors.push("Expense createdAt is required.");
        }

        if (!expense.createdBy.trim()) {
            errors.push("Expense createdBy is required.");
        }

        if (!expense.updatedAt.trim()) {
            errors.push("Expense updatedAt is required.");
        }

        if (!expense.updatedBy.trim()) {
            errors.push("Expense updatedBy is required.");
        }

        if (expense.status === "posted") {
            if (!expense.postedAt?.trim()) {
                errors.push("Posted expense postedAt is required.");
            }

            if (!expense.postedBy?.trim()) {
                errors.push("Posted expense postedBy is required.");
            }
        }

        if (expense.status === "voided") {
            if (!expense.voidedAt?.trim()) {
                errors.push("Voided expense voidedAt is required.");
            }

            if (!expense.voidedBy?.trim()) {
                errors.push("Voided expense voidedBy is required.");
            }

            if (!expense.voidReason?.trim()) {
                errors.push("Voided expense reason is required.");
            }
        }

        return errors;

    }

}

function isValidExpenseDate(value: string): boolean {

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    return !Number.isNaN(date.getTime())
        && date.toISOString().slice(0, 10) === value;

}
