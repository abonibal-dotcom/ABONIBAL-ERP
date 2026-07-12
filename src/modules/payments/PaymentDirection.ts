export type PaymentDirection = "in" | "out";

export function isPaymentDirection(value: unknown): value is PaymentDirection {

    return value === "in" || value === "out";

}
