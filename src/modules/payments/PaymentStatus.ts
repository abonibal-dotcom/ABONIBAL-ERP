export type PaymentStatus = "draft" | "posted" | "voided";

export function isPaymentStatus(value: unknown): value is PaymentStatus {

    return value === "draft"
        || value === "posted"
        || value === "voided";

}
