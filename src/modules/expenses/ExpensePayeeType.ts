export const expensePayeeTypes = [
    "supplier",
    "customer",
    "employee",
    "other"
] as const;

export type ExpensePayeeType = typeof expensePayeeTypes[number];

export function isExpensePayeeType(value: unknown): value is ExpensePayeeType {

    return typeof value === "string"
        && expensePayeeTypes.includes(value as ExpensePayeeType);

}
