export const invoiceReturnStatuses = [
    "recorded",
    "executed",
] as const;

export type InvoiceReturnStatus = typeof invoiceReturnStatuses[number];

export function isInvoiceReturnStatus(
    value: unknown
): value is InvoiceReturnStatus {

    return typeof value === "string"
        && invoiceReturnStatuses.includes(value as InvoiceReturnStatus);

}
