export type PaymentPartyType = "customer" | "supplier" | "other";

export function isPaymentPartyType(value: unknown): value is PaymentPartyType {

    return value === "customer"
        || value === "supplier"
        || value === "other";

}
