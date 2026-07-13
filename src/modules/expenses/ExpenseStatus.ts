export type ExpenseStatus = "draft" | "posted" | "voided";

export function isExpenseStatus(value: unknown): value is ExpenseStatus {

    return value === "draft"
        || value === "posted"
        || value === "voided";

}
