import type { AuthStateService } from "../../auth/AuthStateService";
import type {
    Supplier,
    SupplierDraftInput,
    SupplierStatus,
    SupplierUpdateInput
} from "../Supplier";
import type { SupplierRepositoryPort } from "../repositories/SupplierRepository";
import { SupplierValidator } from "../validators/SupplierValidator";

export class SupplierService {

    private readonly repository: SupplierRepositoryPort;
    private readonly validator: SupplierValidator;
    private readonly authStateService: AuthStateService;

    public constructor(
        repository: SupplierRepositoryPort,
        validator: SupplierValidator,
        authStateService: AuthStateService
    ) {

        this.repository = repository;
        this.validator = validator;
        this.authStateService = authStateService;

    }

    public getAll(): Supplier[] {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return [];
        }

        return this.repository
            .allForAccount(accountContext.accountId)
            .filter(supplier => !supplier.isDeleted);

    }

    public create(input: SupplierDraftInput): SupplierMutationResult {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return failedSupplierMutationResult("Authenticated account is required.");
        }

        const now = new Date().toISOString();
        const supplier: Supplier = {
            id: generateSupplierId(),
            accountId: accountContext.accountId,
            displayName: normalizeRequiredText(input.displayName),
            phone: normalizeOptionalText(input.phone),
            secondaryPhone: normalizeOptionalText(input.secondaryPhone),
            email: normalizeOptionalText(input.email),
            address: normalizeOptionalText(input.address),
            companyName: normalizeOptionalText(input.companyName),
            taxNumber: normalizeOptionalText(input.taxNumber),
            notes: normalizeOptionalText(input.notes),
            status: normalizeStatus(input.status),
            createdAt: now,
            createdBy: accountContext.userId,
            updatedAt: now,
            updatedBy: accountContext.userId
        };
        const errors = this.validator.validate(supplier);

        if (errors.length > 0) {
            return failedSupplierMutationResult(errors);
        }

        try {
            this.repository.addToAccount(
                accountContext.accountId,
                supplier
            );
        } catch (error) {
            return failedSupplierMutationResult(safePersistenceError(error));
        }

        return {
            success: true,
            errors: [],
            supplier
        };

    }

    public update(
        id: string,
        input: SupplierUpdateInput
    ): SupplierMutationResult {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return failedSupplierMutationResult("Authenticated account is required.");
        }

        const current = this.repository.findForAccount(
            accountContext.accountId,
            id
        );

        if (!current || current.isDeleted) {
            return failedSupplierMutationResult("Supplier not found.");
        }

        const now = new Date().toISOString();
        const updated: Supplier = {
            ...current,
            accountId: accountContext.accountId,
            displayName: input.displayName === undefined
                ? current.displayName
                : normalizeRequiredText(input.displayName),
            phone: resolveOptionalText(current.phone, input.phone),
            secondaryPhone: resolveOptionalText(
                current.secondaryPhone,
                input.secondaryPhone
            ),
            email: resolveOptionalText(current.email, input.email),
            address: resolveOptionalText(current.address, input.address),
            companyName: resolveOptionalText(
                current.companyName,
                input.companyName
            ),
            taxNumber: resolveOptionalText(current.taxNumber, input.taxNumber),
            notes: resolveOptionalText(current.notes, input.notes),
            status: input.status === undefined
                ? current.status
                : normalizeStatus(input.status),
            updatedAt: now,
            updatedBy: accountContext.userId
        };
        const errors = this.validator.validate(updated);

        if (errors.length > 0) {
            return failedSupplierMutationResult(errors);
        }

        try {
            this.repository.updateForAccount(
                accountContext.accountId,
                id,
                updated
            );
        } catch (error) {
            return failedSupplierMutationResult(safePersistenceError(error));
        }

        return {
            success: true,
            errors: [],
            supplier: updated
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
            return ["Supplier not found."];
        }

        const now = new Date().toISOString();

        try {
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
        } catch (error) {
            return [safePersistenceError(error)];
        }

        return [];

    }

    public find(id: string): Supplier | undefined {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return undefined;
        }

        const supplier = this.repository.findForAccount(
            accountContext.accountId,
            id
        );

        if (supplier?.isDeleted) {
            return undefined;
        }

        return supplier;

    }

    private currentAccountContext(): SupplierAccountContext | null {

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

export interface SupplierMutationResult {

    success: boolean;
    errors: string[];
    supplier: Supplier | null;

}

function failedSupplierMutationResult(
    errors: string | string[]
): SupplierMutationResult {

    return {
        success: false,
        errors: Array.isArray(errors) ? errors : [errors],
        supplier: null
    };

}

function generateSupplierId(): string {

    const cryptoApi = globalThis.crypto;

    if (typeof cryptoApi?.randomUUID === "function") {
        return cryptoApi.randomUUID();
    }

    return `supplier-${Date.now()}-${Math.random().toString(36).slice(2)}`;

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

function normalizeStatus(status: SupplierStatus | undefined): SupplierStatus {

    return status ?? "active";

}

interface SupplierAccountContext {

    accountId: string;
    userId: string;

}

function safePersistenceError(error: unknown): string {

    return isSafePersistenceError(error)
        ? error.messageSafe
        : "Supplier persistence failed safely.";

}

function isSafePersistenceError(
    error: unknown
): error is { messageSafe: string } {

    return Boolean(error)
        && typeof error === "object"
        && typeof (error as { messageSafe?: unknown }).messageSafe === "string";

}
