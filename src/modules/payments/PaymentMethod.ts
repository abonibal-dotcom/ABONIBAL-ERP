export type PaymentMethod = "cash" | "bank_transfer" | "card" | "other";

export function isPaymentMethod(value: unknown): value is PaymentMethod {

    return value === "cash"
        || value === "bank_transfer"
        || value === "card"
        || value === "other";

}
