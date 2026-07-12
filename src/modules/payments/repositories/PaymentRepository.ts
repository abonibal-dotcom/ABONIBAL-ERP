import { Repository } from "../../../core/repositories/Repository";
import type { Driver } from "../../../core/persistence/Driver";
import type { Payment } from "../Payment";
import { isPaymentDirection } from "../PaymentDirection";
import { isPaymentMethod } from "../PaymentMethod";
import { isPaymentPartyType } from "../PaymentPartyType";
import { isPaymentStatus } from "../PaymentStatus";
import { paymentStorageKeyForAccount } from "../persistence/PaymentPersistenceKey";

export class PaymentRepository extends Repository<Payment> {

    public constructor(driver: Driver) {

        super("payments", driver);

    }

    public allForAccount(accountId: string): Payment[] {

        const storedPayments = this.driver.read<unknown[]>(
            paymentStorageKeyForAccount(accountId)
        );

        if (!Array.isArray(storedPayments)) {
            return [];
        }

        return storedPayments.filter(isPayment);

    }

    public saveAllForAccount(accountId: string, payments: Payment[]): void {

        this.saveForAccount(accountId, payments);

    }

    public appendForAccount(accountId: string, payment: Payment): void {

        const payments = this.allForAccount(accountId);

        payments.push(payment);

        this.saveForAccount(accountId, payments);

    }

    public findForAccount(
        accountId: string,
        paymentId: string
    ): Payment | undefined {

        return this
            .allForAccount(accountId)
            .find(payment => payment.id === paymentId);

    }

    public updateForAccount(
        accountId: string,
        paymentId: string,
        payment: Payment
    ): Payment | null {

        const payments = this.allForAccount(accountId);
        const paymentIndex = payments.findIndex(
            currentPayment => currentPayment.id === paymentId
        );

        if (paymentIndex === -1) {
            return null;
        }

        payments[paymentIndex] = payment;

        this.saveForAccount(accountId, payments);

        return payment;

    }

    private saveForAccount(accountId: string, payments: Payment[]): void {

        this.driver.write<Payment[]>(
            paymentStorageKeyForAccount(accountId),
            payments
        );

    }

}

function isPayment(value: unknown): value is Payment {

    if (!value || typeof value !== "object") {
        return false;
    }

    const payment = value as Partial<Payment>;

    return isNonEmptyString(payment.id)
        && isNonEmptyString(payment.accountId)
        && isNonEmptyString(payment.paymentNumber)
        && isPaymentDirection(payment.direction)
        && isPaymentPartyType(payment.partyType)
        && isNullableRecord(payment.partySnapshot)
        && isPositiveFiniteNumber(payment.amount)
        && isPaymentMethod(payment.method)
        && isPaymentStatus(payment.status)
        && isNonEmptyString(payment.createdAt)
        && isNonEmptyString(payment.createdBy)
        && isNonEmptyString(payment.updatedAt)
        && isNonEmptyString(payment.updatedBy);

}

function isNonEmptyString(value: unknown): value is string {

    return typeof value === "string" && value.trim().length > 0;

}

function isPositiveFiniteNumber(value: unknown): value is number {

    return typeof value === "number" && Number.isFinite(value) && value > 0;

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
