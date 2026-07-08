import type {
    Customer,
    CustomerDraftInput,
    CustomerStatus,
    CustomerUpdateInput
} from "../Customer";
import { CustomerRepository } from "../repositories/CustomerRepository";
import { CustomerValidator } from "../validators/CustomerValidator";
import type { AuthStateService } from "../../auth/AuthStateService";

export class CustomerService {

    private repository: CustomerRepository;
    private validator: CustomerValidator;
    private authStateService: AuthStateService;

    constructor(
        repository: CustomerRepository,
        validator: CustomerValidator,
        authStateService: AuthStateService
    ) {

        this.repository = repository;
        this.validator = validator;
        this.authStateService = authStateService;

    }

    public getAll(): Customer[] {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return [];
        }

        return this.repository
            .allForAccount(accountContext.accountId)
            .filter(customer => !customer.isDeleted);

    }

    public create(input: CustomerDraftInput): CustomerMutationResult {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return failedCustomerMutationResult("Authenticated account is required.");
        }

        const now = new Date().toISOString();

        const customer: Customer = {
            id: generateCustomerId(),
            accountId: accountContext.accountId,
            displayName: normalizeRequiredText(input.displayName),
            phone: normalizeOptionalText(input.phone),
            secondaryPhone: normalizeOptionalText(input.secondaryPhone),
            email: normalizeOptionalText(input.email),
            address: normalizeOptionalText(input.address),
            notes: normalizeOptionalText(input.notes),
            status: normalizeStatus(input.status),
            createdAt: now,
            createdBy: accountContext.userId,
            updatedAt: now,
            updatedBy: accountContext.userId
        };

        const errors = this.validator.validate(customer);

        if (errors.length > 0) {
            return failedCustomerMutationResult(errors);
        }

        this.repository.addToAccount(
            accountContext.accountId,
            customer
        );

        return {
            success: true,
            errors: [],
            customer
        };

    }

    public update(id: string, input: CustomerUpdateInput): CustomerMutationResult {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return failedCustomerMutationResult("Authenticated account is required.");
        }

        const current = this.repository.findForAccount(
            accountContext.accountId,
            id
        );

        if (!current || current.isDeleted) {
            return failedCustomerMutationResult("العميل غير موجود.");
        }

        const now = new Date().toISOString();

        const updated: Customer = {
            ...current,
            accountId: accountContext.accountId,
            displayName: input.displayName === undefined
                ? current.displayName
                : normalizeRequiredText(input.displayName),
            phone: resolveOptionalText(current.phone, input.phone),
            secondaryPhone: resolveOptionalText(current.secondaryPhone, input.secondaryPhone),
            email: resolveOptionalText(current.email, input.email),
            address: resolveOptionalText(current.address, input.address),
            notes: resolveOptionalText(current.notes, input.notes),
            status: input.status === undefined
                ? current.status
                : normalizeStatus(input.status),
            updatedAt: now,
            updatedBy: accountContext.userId
        };

        const errors = this.validator.validate(updated);

        if (errors.length > 0) {
            return failedCustomerMutationResult(errors);
        }

        this.repository.updateForAccount(
            accountContext.accountId,
            id,
            updated
        );

        return {
            success: true,
            errors: [],
            customer: updated
        };

    }

    public safeDelete(id: string): string[] {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return ["Authenticated account is required."];
        }

        const current = this.repository.findForAccount(
            accountContext.accountId,
            id
        );

        if (!current || current.isDeleted) {
            return ["العميل غير موجود."];
        }

        const now = new Date().toISOString();

        this.repository.updateForAccount(
            accountContext.accountId,
            id,
            {
                ...current,
                accountId: accountContext.accountId,
                deletedAt: now,
                deletedBy: accountContext.userId,
                isDeleted: true,
                updatedAt: now,
                updatedBy: accountContext.userId
            }
        );

        return [];

    }

    public find(id: string): Customer | undefined {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return undefined;
        }

        const customer = this.repository.findForAccount(
            accountContext.accountId,
            id
        );

        if (customer?.isDeleted) {
            return undefined;
        }

        return customer;

    }

    private currentAccountContext(): CustomerAccountContext | null {

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

export interface CustomerMutationResult {

    success: boolean;
    errors: string[];
    customer: Customer | null;

}

function failedCustomerMutationResult(
    errors: string | string[]
): CustomerMutationResult {

    return {
        success: false,
        errors: Array.isArray(errors) ? errors : [errors],
        customer: null
    };

}

function generateCustomerId(): string {

    const cryptoApi = globalThis.crypto;

    if (typeof cryptoApi?.randomUUID === "function") {
        return cryptoApi.randomUUID();
    }

    return `customer-${Date.now()}-${Math.random().toString(36).slice(2)}`;

}

function normalizeRequiredText(value: string): string {

    return value.trim();

}

function normalizeOptionalText(value: string | undefined): string | undefined {

    const normalizedValue = value?.trim() ?? "";

    return normalizedValue || undefined;

}

function resolveOptionalText(
    currentValue: string | undefined,
    nextValue: string | undefined
): string | undefined {

    if (nextValue === undefined) {
        return currentValue;
    }

    return normalizeOptionalText(nextValue);

}

function normalizeStatus(status: CustomerStatus | undefined): CustomerStatus {

    return status ?? "active";

}

interface CustomerAccountContext {

    accountId: string;
    userId: string;

}
