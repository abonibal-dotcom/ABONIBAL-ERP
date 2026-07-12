import type { Payment } from "../Payment";
import { isPaymentDirection } from "../PaymentDirection";
import { isPaymentMethod } from "../PaymentMethod";
import { isPaymentPartyType } from "../PaymentPartyType";
import { isPaymentStatus } from "../PaymentStatus";

export class PaymentValidator {

    public validate(payment: Payment): string[] {

        const errors: string[] = [];

        if (!payment.id.trim()) {
            errors.push("Payment id is required.");
        }

        if (!payment.accountId.trim()) {
            errors.push("Payment accountId is required.");
        }

        if (!payment.paymentNumber.trim()) {
            errors.push("Payment number is required.");
        }

        if (!isPaymentDirection(payment.direction)) {
            errors.push("Payment direction is invalid.");
        }

        if (!isPaymentPartyType(payment.partyType)) {
            errors.push("Payment partyType is invalid.");
        }

        if (!isNullableRecord(payment.partySnapshot)) {
            errors.push("Payment partySnapshot is invalid.");
        }

        if (!Number.isFinite(payment.amount) || payment.amount <= 0) {
            errors.push("Payment amount must be greater than zero.");
        }

        if (!isPaymentMethod(payment.method)) {
            errors.push("Payment method is invalid.");
        }

        if (!isPaymentStatus(payment.status)) {
            errors.push("Payment status is invalid.");
        }

        if (!payment.createdAt.trim()) {
            errors.push("Payment createdAt is required.");
        }

        if (!payment.createdBy.trim()) {
            errors.push("Payment createdBy is required.");
        }

        if (!payment.updatedAt.trim()) {
            errors.push("Payment updatedAt is required.");
        }

        if (!payment.updatedBy.trim()) {
            errors.push("Payment updatedBy is required.");
        }

        if (payment.status === "posted") {
            if (!payment.postedAt?.trim()) {
                errors.push("Posted payment postedAt is required.");
            }

            if (!payment.postedBy?.trim()) {
                errors.push("Posted payment postedBy is required.");
            }
        }

        if (payment.status === "voided") {
            if (!payment.voidedAt?.trim()) {
                errors.push("Voided payment voidedAt is required.");
            }

            if (!payment.voidedBy?.trim()) {
                errors.push("Voided payment voidedBy is required.");
            }
        }

        return errors;

    }

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
