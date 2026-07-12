import type { AuthStateService } from "../../auth/AuthStateService";
import type { Payment, PaymentDraftInput, PaymentUpdateInput } from "../Payment";
import { PaymentRepository } from "../repositories/PaymentRepository";
import { PaymentValidator } from "../validators/PaymentValidator";

export class PaymentService {

    private readonly repository: PaymentRepository;
    private readonly validator: PaymentValidator;
    private readonly authStateService: AuthStateService;

    public constructor(
        repository: PaymentRepository,
        validator: PaymentValidator,
        authStateService: AuthStateService
    ) {

        this.repository = repository;
        this.validator = validator;
        this.authStateService = authStateService;

    }

    public getAll(): Payment[] {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return [];
        }

        return this.repository.allForAccount(accountContext.accountId);

    }

    public find(paymentId: string): Payment | undefined {

        const accountContext = this.currentAccountContext();
        const normalizedPaymentId = paymentId.trim();

        if (!accountContext || !normalizedPaymentId) {
            return undefined;
        }

        return this.repository.findForAccount(
            accountContext.accountId,
            normalizedPaymentId
        );

    }

    public createDraft(input: PaymentDraftInput): PaymentMutationResult {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return failedPaymentMutationResult("Authenticated account is required.");
        }

        const createdAt = new Date().toISOString();
        const existingPayments = this.repository.allForAccount(
            accountContext.accountId
        );
        const payment: Payment = {
            id: generatePaymentId(),
            accountId: accountContext.accountId,
            paymentNumber: normalizeOptionalText(input.paymentNumber)
                ?? generatePaymentNumber(existingPayments, createdAt),
            direction: input.direction,
            partyType: input.partyType,
            partyId: normalizeOptionalText(input.partyId),
            partySnapshot: input.partySnapshot ?? null,
            amount: normalizeAmount(input.amount),
            method: input.method,
            referenceNumber: normalizeOptionalText(input.referenceNumber),
            notes: normalizeOptionalText(input.notes),
            status: "draft",
            createdAt,
            createdBy: accountContext.userId,
            updatedAt: createdAt,
            updatedBy: accountContext.userId
        };
        const errors = this.validator.validate(payment);

        if (errors.length > 0) {
            return failedPaymentMutationResult(errors);
        }

        this.repository.appendForAccount(accountContext.accountId, payment);

        return {
            success: true,
            errors: [],
            payment
        };

    }

    public updateDraft(
        paymentId: string,
        input: PaymentUpdateInput
    ): PaymentMutationResult {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return failedPaymentMutationResult("Authenticated account is required.");
        }

        const currentPayment = this.repository.findForAccount(
            accountContext.accountId,
            paymentId.trim()
        );

        if (!currentPayment) {
            return failedPaymentMutationResult("Payment not found.");
        }

        if (currentPayment.status !== "draft") {
            return failedPaymentMutationResult("Only draft payments can be updated.");
        }

        const updatedAt = new Date().toISOString();
        const updatedPayment: Payment = {
            ...currentPayment,
            accountId: accountContext.accountId,
            paymentNumber: input.paymentNumber === undefined
                ? currentPayment.paymentNumber
                : normalizeRequiredText(input.paymentNumber),
            direction: input.direction === undefined
                ? currentPayment.direction
                : input.direction,
            partyType: input.partyType === undefined
                ? currentPayment.partyType
                : input.partyType,
            partyId: input.partyId === undefined
                ? currentPayment.partyId
                : normalizeOptionalText(input.partyId),
            partySnapshot: input.partySnapshot === undefined
                ? currentPayment.partySnapshot
                : input.partySnapshot,
            amount: input.amount === undefined
                ? currentPayment.amount
                : normalizeAmount(input.amount),
            method: input.method === undefined
                ? currentPayment.method
                : input.method,
            referenceNumber: input.referenceNumber === undefined
                ? currentPayment.referenceNumber
                : normalizeOptionalText(input.referenceNumber),
            notes: input.notes === undefined
                ? currentPayment.notes
                : normalizeOptionalText(input.notes),
            updatedAt,
            updatedBy: accountContext.userId
        };
        const errors = this.validator.validate(updatedPayment);

        if (errors.length > 0) {
            return failedPaymentMutationResult(errors);
        }

        const savedPayment = this.repository.updateForAccount(
            accountContext.accountId,
            currentPayment.id,
            updatedPayment
        );

        if (!savedPayment) {
            return failedPaymentMutationResult("Payment not found.");
        }

        return {
            success: true,
            errors: [],
            payment: savedPayment
        };

    }

    public post(paymentId: string): PaymentMutationResult {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return failedPaymentMutationResult("Authenticated account is required.");
        }

        const currentPayment = this.repository.findForAccount(
            accountContext.accountId,
            paymentId.trim()
        );

        if (!currentPayment) {
            return failedPaymentMutationResult("Payment not found.");
        }

        if (currentPayment.status !== "draft") {
            return failedPaymentMutationResult("Only draft payments can be posted.");
        }

        const postedAt = new Date().toISOString();
        const postedPayment: Payment = {
            ...currentPayment,
            accountId: accountContext.accountId,
            status: "posted",
            postedAt,
            postedBy: accountContext.userId,
            updatedAt: postedAt,
            updatedBy: accountContext.userId
        };
        const errors = this.validator.validate(postedPayment);

        if (errors.length > 0) {
            return failedPaymentMutationResult(errors);
        }

        const savedPayment = this.repository.updateForAccount(
            accountContext.accountId,
            currentPayment.id,
            postedPayment
        );

        if (!savedPayment) {
            return failedPaymentMutationResult("Payment not found.");
        }

        return {
            success: true,
            errors: [],
            payment: savedPayment
        };

    }

    public voidPayment(
        paymentId: string,
        reason = ""
    ): PaymentMutationResult {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return failedPaymentMutationResult("Authenticated account is required.");
        }

        const currentPayment = this.repository.findForAccount(
            accountContext.accountId,
            paymentId.trim()
        );

        if (!currentPayment) {
            return failedPaymentMutationResult("Payment not found.");
        }

        if (currentPayment.status === "voided") {
            return failedPaymentMutationResult("Payment is already voided.");
        }

        const voidedAt = new Date().toISOString();
        const voidedPayment: Payment = {
            ...currentPayment,
            accountId: accountContext.accountId,
            status: "voided",
            voidedAt,
            voidedBy: accountContext.userId,
            voidReason: normalizeOptionalText(reason) ?? "Payment voided",
            updatedAt: voidedAt,
            updatedBy: accountContext.userId
        };
        const errors = this.validator.validate(voidedPayment);

        if (errors.length > 0) {
            return failedPaymentMutationResult(errors);
        }

        const savedPayment = this.repository.updateForAccount(
            accountContext.accountId,
            currentPayment.id,
            voidedPayment
        );

        if (!savedPayment) {
            return failedPaymentMutationResult("Payment not found.");
        }

        return {
            success: true,
            errors: [],
            payment: savedPayment
        };

    }

    private currentAccountContext(): PaymentAccountContext | null {

        const state = this.authStateService.getState();

        if (state.status !== "authenticated") {
            return null;
        }

        const accountId = state.session.account.id.trim();
        const userAccountId = state.session.user.accountId.trim();
        const userId = state.session.user.id.trim();

        if (!accountId || accountId !== userAccountId || !userId) {
            return null;
        }

        return {
            accountId,
            userId
        };

    }

}

export interface PaymentMutationResult {

    success: boolean;
    errors: string[];
    payment: Payment | null;

}

interface PaymentAccountContext {

    accountId: string;
    userId: string;

}

function failedPaymentMutationResult(
    errors: string | string[]
): PaymentMutationResult {

    return {
        success: false,
        errors: Array.isArray(errors) ? errors : [errors],
        payment: null
    };

}

function generatePaymentId(): string {

    const cryptoApi = globalThis.crypto;

    if (typeof cryptoApi?.randomUUID === "function") {
        return cryptoApi.randomUUID();
    }

    return `payment-${Date.now()}-${Math.random().toString(36).slice(2)}`;

}

function generatePaymentNumber(
    existingPayments: Payment[],
    timestamp: string
): string {

    const datePart = timestamp.slice(0, 10).replaceAll("-", "");
    const prefix = `PAY-${datePart}-`;
    const existingNumbers = new Set(
        existingPayments.map(payment => payment.paymentNumber)
    );
    let sequence = existingPayments
        .map(payment => payment.paymentNumber)
        .filter(paymentNumber => paymentNumber.startsWith(prefix))
        .map(paymentNumber => Number(paymentNumber.slice(prefix.length)))
        .filter(Number.isFinite)
        .reduce((max, current) => Math.max(max, current), 0) + 1;
    let paymentNumber = formatPaymentNumber(prefix, sequence);

    while (existingNumbers.has(paymentNumber)) {
        sequence += 1;
        paymentNumber = formatPaymentNumber(prefix, sequence);
    }

    return paymentNumber;

}

function formatPaymentNumber(prefix: string, sequence: number): string {

    return `${prefix}${String(sequence).padStart(4, "0")}`;

}

function normalizeRequiredText(value: string): string {

    return value.trim();

}

function normalizeOptionalText(value: string | undefined): string | undefined {

    const normalizedValue = value?.trim() ?? "";

    return normalizedValue || undefined;

}

function normalizeAmount(value: number): number {

    return typeof value === "number" && Number.isFinite(value)
        ? value
        : 0;

}
