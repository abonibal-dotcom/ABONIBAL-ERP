export type PurchaseStatus = "draft" | "posted" | "cancelled";

export function isPurchaseStatus(value: unknown): value is PurchaseStatus {

    return value === "draft"
        || value === "posted"
        || value === "cancelled";

}
