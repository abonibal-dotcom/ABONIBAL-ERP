export const expensePaymentMethods = [
    "cash",
    "bank_transfer",
    "card",
    "other"
] as const;

export type ExpensePaymentMethod = typeof expensePaymentMethods[number];

export function isExpensePaymentMethod(
    value: unknown
): value is ExpensePaymentMethod {

    return typeof value === "string"
        && expensePaymentMethods.includes(value as ExpensePaymentMethod);

}
