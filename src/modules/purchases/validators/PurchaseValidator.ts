import type { Purchase, PurchaseLine } from "../Purchase";
import { isPurchaseStatus } from "../PurchaseStatus";

export class PurchaseValidator {

    public validate(purchase: Purchase): string[] {

        const errors: string[] = [];

        if (!purchase.id.trim()) {
            errors.push("Purchase id is required.");
        }

        if (!purchase.accountId.trim()) {
            errors.push("Purchase accountId is required.");
        }

        if (!purchase.purchaseNumber.trim()) {
            errors.push("Purchase number is required.");
        }

        if (!isPurchaseStatus(purchase.status)) {
            errors.push("Purchase status is invalid.");
        }

        if (!isNullableRecord(purchase.supplierSnapshot)) {
            errors.push("Purchase supplierSnapshot is invalid.");
        }

        if (!Array.isArray(purchase.lines) || purchase.lines.length === 0) {
            errors.push("Purchase must include at least one line.");
        } else {
            for (const line of purchase.lines) {
                errors.push(...this.validateLine(line));
            }
        }

        if (!isFiniteCurrency(purchase.subtotal)) {
            errors.push("Purchase subtotal must be a finite number.");
        }

        if (!isFiniteCurrency(purchase.discount)) {
            errors.push("Purchase discount must be a finite number.");
        }

        if (!isFiniteCurrency(purchase.tax)) {
            errors.push("Purchase tax must be a finite number.");
        }

        if (!isFiniteCurrency(purchase.total)) {
            errors.push("Purchase total must be a finite number.");
        }

        if (!purchase.createdAt.trim()) {
            errors.push("Purchase createdAt is required.");
        }

        if (!purchase.createdBy.trim()) {
            errors.push("Purchase createdBy is required.");
        }

        if (!purchase.updatedAt.trim()) {
            errors.push("Purchase updatedAt is required.");
        }

        if (!purchase.updatedBy.trim()) {
            errors.push("Purchase updatedBy is required.");
        }

        if (purchase.status === "posted") {
            if (!purchase.postedAt?.trim()) {
                errors.push("Posted purchase postedAt is required.");
            }

            if (!purchase.postedBy?.trim()) {
                errors.push("Posted purchase postedBy is required.");
            }
        }

        if (purchase.status === "cancelled") {
            if (!purchase.cancelledAt?.trim()) {
                errors.push("Cancelled purchase cancelledAt is required.");
            }

            if (!purchase.cancelledBy?.trim()) {
                errors.push("Cancelled purchase cancelledBy is required.");
            }
        }

        return errors;

    }

    private validateLine(line: PurchaseLine): string[] {

        const errors: string[] = [];

        if (!line.id.trim()) {
            errors.push("Purchase line id is required.");
        }

        if (!line.productNameSnapshot.trim()) {
            errors.push("Purchase line product snapshot is required.");
        }

        if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
            errors.push("Purchase line quantity must be a positive number.");
        }

        if (!isFiniteCurrency(line.unitCost)) {
            errors.push("Purchase line unit cost must be a finite number.");
        }

        if (!isFiniteCurrency(line.discount)) {
            errors.push("Purchase line discount must be a finite number.");
        }

        if (!isFiniteCurrency(line.tax)) {
            errors.push("Purchase line tax must be a finite number.");
        }

        if (!isFiniteCurrency(line.lineSubtotal)) {
            errors.push("Purchase line subtotal must be a finite number.");
        }

        if (!isFiniteCurrency(line.lineTotal)) {
            errors.push("Purchase line total must be a finite number.");
        }

        return errors;

    }

}

function isFiniteCurrency(value: number): boolean {

    return Number.isFinite(value) && value >= 0;

}

function isNullableRecord(
    value: unknown
): value is Record<string, unknown> | null {

    return value === null
        || (
            typeof value === "object"
            && !Array.isArray(value)
        );

}
