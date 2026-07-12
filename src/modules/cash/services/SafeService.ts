import type { AuthStateService } from "../../auth/AuthStateService";
import type { Safe, SafeDraftInput, SafeUpdateInput } from "../Safe";
import { SafeRepository } from "../repositories/SafeRepository";
import { SafeValidator } from "../validators/SafeValidator";

export class SafeService {

    private readonly repository: SafeRepository;
    private readonly validator: SafeValidator;
    private readonly authStateService: AuthStateService;
    private movementPolicy: SafeMovementPolicy = {
        hasPostedMovements: () => false,
        getCurrentBalance: () => 0
    };

    public constructor(
        repository: SafeRepository,
        validator: SafeValidator,
        authStateService: AuthStateService
    ) {

        this.repository = repository;
        this.validator = validator;
        this.authStateService = authStateService;

    }

    public configureMovementPolicy(policy: SafeMovementPolicy): void {

        this.movementPolicy = policy;

    }

    public getAll(): Safe[] {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return [];
        }

        return this.repository.allForAccount(accountContext.accountId);

    }

    public find(safeId: string): Safe | undefined {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return undefined;
        }

        return this.repository.findForAccount(
            accountContext.accountId,
            safeId.trim()
        );

    }

    public create(input: SafeDraftInput): SafeMutationResult {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return failedSafeMutationResult("Authenticated account is required.");
        }

        const now = new Date().toISOString();
        const safe: Safe = {
            id: generateSafeId(),
            accountId: accountContext.accountId,
            displayName: normalizeRequiredText(input.displayName),
            code: normalizeOptionalText(input.code),
            currency: normalizeCurrency(input.currency),
            status: "active",
            isDefault: input.isDefault === true,
            notes: normalizeOptionalText(input.notes),
            createdAt: now,
            createdBy: accountContext.userId,
            updatedAt: now,
            updatedBy: accountContext.userId
        };
        const errors = this.validator.validate(safe);

        if (errors.length > 0) {
            return failedSafeMutationResult(errors);
        }

        const safes = this.repository.allForAccount(accountContext.accountId);

        if (safe.isDefault) {
            for (const currentSafe of safes) {
                currentSafe.isDefault = false;
                currentSafe.updatedAt = now;
                currentSafe.updatedBy = accountContext.userId;
            }
        }

        safes.push(safe);
        this.repository.saveAllForAccount(accountContext.accountId, safes);

        return successfulSafeMutationResult(safe);

    }

    public update(
        safeId: string,
        input: SafeUpdateInput
    ): SafeMutationResult {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return failedSafeMutationResult("Authenticated account is required.");
        }

        const currentSafe = this.repository.findForAccount(
            accountContext.accountId,
            safeId.trim()
        );

        if (!currentSafe) {
            return failedSafeMutationResult("Safe not found.");
        }

        if (
            input.currency !== undefined
            && normalizeCurrency(input.currency) !== currentSafe.currency
            && this.movementPolicy.hasPostedMovements(currentSafe.id)
        ) {
            return failedSafeMutationResult(
                "Safe currency cannot change after a movement is posted."
            );
        }

        const updatedAt = new Date().toISOString();
        const updatedSafe: Safe = {
            ...currentSafe,
            accountId: accountContext.accountId,
            displayName: input.displayName === undefined
                ? currentSafe.displayName
                : normalizeRequiredText(input.displayName),
            code: input.code === undefined
                ? currentSafe.code
                : normalizeOptionalText(input.code),
            currency: input.currency === undefined
                ? currentSafe.currency
                : normalizeCurrency(input.currency),
            notes: input.notes === undefined
                ? currentSafe.notes
                : normalizeOptionalText(input.notes),
            updatedAt,
            updatedBy: accountContext.userId
        };
        const errors = this.validator.validate(updatedSafe);

        if (errors.length > 0) {
            return failedSafeMutationResult(errors);
        }

        const savedSafe = this.repository.updateForAccount(
            accountContext.accountId,
            currentSafe.id,
            updatedSafe
        );

        return savedSafe
            ? successfulSafeMutationResult(savedSafe)
            : failedSafeMutationResult("Safe not found.");

    }

    public setDefaultSafe(safeId: string): SafeMutationResult {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return failedSafeMutationResult("Authenticated account is required.");
        }

        const safes = this.repository.allForAccount(accountContext.accountId);
        const targetSafe = safes.find(safe => safe.id === safeId.trim());

        if (!targetSafe) {
            return failedSafeMutationResult("Safe not found.");
        }

        if (targetSafe.status !== "active") {
            return failedSafeMutationResult("Only an active Safe can be default.");
        }

        const updatedAt = new Date().toISOString();

        for (const safe of safes) {
            safe.isDefault = safe.id === targetSafe.id;
            safe.updatedAt = updatedAt;
            safe.updatedBy = accountContext.userId;
        }

        this.repository.saveAllForAccount(accountContext.accountId, safes);

        return successfulSafeMutationResult(targetSafe);

    }

    public deactivate(safeId: string): SafeMutationResult {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return failedSafeMutationResult("Authenticated account is required.");
        }

        const currentSafe = this.repository.findForAccount(
            accountContext.accountId,
            safeId.trim()
        );

        if (!currentSafe) {
            return failedSafeMutationResult("Safe not found.");
        }

        if (currentSafe.status === "inactive") {
            return successfulSafeMutationResult(currentSafe);
        }

        if (Math.abs(this.movementPolicy.getCurrentBalance(currentSafe.id)) > 1e-9) {
            return failedSafeMutationResult(
                "Safe must have a zero balance before deactivation."
            );
        }

        const deactivatedAt = new Date().toISOString();
        const deactivatedSafe: Safe = {
            ...currentSafe,
            accountId: accountContext.accountId,
            status: "inactive",
            isDefault: false,
            deactivatedAt,
            deactivatedBy: accountContext.userId,
            updatedAt: deactivatedAt,
            updatedBy: accountContext.userId
        };
        const errors = this.validator.validate(deactivatedSafe);

        if (errors.length > 0) {
            return failedSafeMutationResult(errors);
        }

        const savedSafe = this.repository.updateForAccount(
            accountContext.accountId,
            currentSafe.id,
            deactivatedSafe
        );

        return savedSafe
            ? successfulSafeMutationResult(savedSafe)
            : failedSafeMutationResult("Safe not found.");

    }

    private currentAccountContext(): SafeAccountContext | null {

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

        return { accountId, userId };

    }

}

export interface SafeMutationResult {

    success: boolean;
    errors: string[];
    safe: Safe | null;

}

interface SafeAccountContext {

    accountId: string;
    userId: string;

}

export interface SafeMovementPolicy {

    hasPostedMovements(safeId: string): boolean;
    getCurrentBalance(safeId: string): number;

}

function successfulSafeMutationResult(safe: Safe): SafeMutationResult {

    return { success: true, errors: [], safe };

}

function failedSafeMutationResult(
    errors: string | string[]
): SafeMutationResult {

    return {
        success: false,
        errors: Array.isArray(errors) ? errors : [errors],
        safe: null
    };

}

function generateSafeId(): string {

    const cryptoApi = globalThis.crypto;

    if (typeof cryptoApi?.randomUUID === "function") {
        return cryptoApi.randomUUID();
    }

    return `safe-${Date.now()}-${Math.random().toString(36).slice(2)}`;

}

function normalizeRequiredText(value: string): string {

    return value.trim();

}

function normalizeOptionalText(value: string | undefined): string | undefined {

    const normalizedValue = value?.trim() ?? "";

    return normalizedValue || undefined;

}

function normalizeCurrency(value: string): string {

    return value.trim().toUpperCase();

}
