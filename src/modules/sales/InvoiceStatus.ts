export const invoiceStatuses = [
    "draft",
    "issued",
    "cancelled",
] as const;

export type InvoiceStatus = typeof invoiceStatuses[number];

export function isInvoiceStatus(value: unknown): value is InvoiceStatus {

    return typeof value === "string"
        && invoiceStatuses.includes(value as InvoiceStatus);

}

