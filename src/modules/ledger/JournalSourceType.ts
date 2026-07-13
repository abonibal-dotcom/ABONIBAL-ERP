export const journalSourceTypes = [
    "manual",
    "payment",
    "expense",
    "cash_movement",
    "sales_invoice",
    "invoice_return",
    "purchase",
    "inventory",
    "opening_balance",
    "reversal",
    "other"
] as const;

export type JournalSourceType = typeof journalSourceTypes[number];

export function isJournalSourceType(value: unknown): value is JournalSourceType {

    return typeof value === "string"
        && journalSourceTypes.includes(value as JournalSourceType);

}
