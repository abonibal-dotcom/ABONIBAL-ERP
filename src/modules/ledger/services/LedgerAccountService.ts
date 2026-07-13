import type { AuthStateService } from "../../auth/AuthStateService";
import type {
    LedgerAccount,
    LedgerAccountDraftInput,
    LedgerAccountUpdateInput
} from "../LedgerAccount";
import type { LedgerAccountType } from "../LedgerAccountType";
import { LedgerAccountRepository } from "../repositories/LedgerAccountRepository";
import { LedgerAccountValidator } from "../validators/LedgerAccountValidator";

export class LedgerAccountService {

    private readonly repository: LedgerAccountRepository;
    private readonly validator: LedgerAccountValidator;
    private readonly authStateService: AuthStateService;
    private usagePolicy: LedgerAccountUsagePolicy = {
        hasPostedUsage: () => false,
        getCurrentBalance: () => 0
    };

    public constructor(
        repository: LedgerAccountRepository,
        validator: LedgerAccountValidator,
        authStateService: AuthStateService
    ) {

        this.repository = repository;
        this.validator = validator;
        this.authStateService = authStateService;

    }

    public configureUsagePolicy(policy: LedgerAccountUsagePolicy): void {

        this.usagePolicy = policy;

    }

    public getAll(): LedgerAccount[] {

        const context = this.currentAccountContext();
        return context ? this.repository.allForAccount(context.accountId) : [];

    }

    public find(ledgerAccountId: string): LedgerAccount | undefined {

        const context = this.currentAccountContext();
        return context
            ? this.repository.findForAccount(
                context.accountId,
                ledgerAccountId.trim()
            )
            : undefined;

    }

    public create(input: LedgerAccountDraftInput): LedgerAccountMutationResult {

        const context = this.currentAccountContext();

        if (!context) return failedLedgerAccountResult("Authenticated account is required.");

        const accounts = this.repository.allForAccount(context.accountId);
        const code = normalizeCode(input.code);

        if (hasDuplicateCode(accounts, code)) {
            return failedLedgerAccountResult("Ledger account code already exists.");
        }

        const parentError = this.validateParent(
            accounts,
            input.parentAccountId,
            input.type
        );

        if (parentError) return failedLedgerAccountResult(parentError);

        const now = new Date().toISOString();
        const account: LedgerAccount = {
            id: generateLedgerAccountId(),
            accountId: context.accountId,
            code,
            displayName: input.displayName.trim(),
            type: input.type,
            parentAccountId: normalizeOptionalText(input.parentAccountId),
            isPostingAccount: input.isPostingAccount,
            status: "active",
            currency: normalizeCurrency(input.currency),
            notes: normalizeOptionalText(input.notes),
            createdAt: now,
            createdBy: context.userId,
            updatedAt: now,
            updatedBy: context.userId
        };
        const errors = this.validator.validate(account);

        if (errors.length > 0) return failedLedgerAccountResult(errors);

        this.repository.appendForAccount(context.accountId, account);
        return successfulLedgerAccountResult(account);

    }

    public update(
        ledgerAccountId: string,
        input: LedgerAccountUpdateInput
    ): LedgerAccountMutationResult {

        const context = this.currentAccountContext();

        if (!context) return failedLedgerAccountResult("Authenticated account is required.");

        const current = this.repository.findForAccount(
            context.accountId,
            ledgerAccountId.trim()
        );

        if (!current) return failedLedgerAccountResult("Ledger account not found.");
        if (current.status !== "active") return failedLedgerAccountResult("Inactive Ledger account cannot be updated.");

        const nextCode = input.code === undefined ? current.code : normalizeCode(input.code);
        const nextType = input.type ?? current.type;
        const nextParentId = input.parentAccountId === undefined
            ? current.parentAccountId
            : normalizeOptionalText(input.parentAccountId ?? undefined);
        const nextPosting = input.isPostingAccount ?? current.isPostingAccount;
        const nextCurrency = input.currency === undefined
            ? current.currency
            : normalizeCurrency(input.currency);
        const accounts = this.repository.allForAccount(context.accountId);

        if (hasDuplicateCode(accounts, nextCode, current.id)) {
            return failedLedgerAccountResult("Ledger account code already exists.");
        }

        const parentError = this.validateParent(
            accounts,
            nextParentId,
            nextType,
            current.id
        );

        if (parentError) return failedLedgerAccountResult(parentError);

        if (
            this.usagePolicy.hasPostedUsage(current.id)
            && (
                nextCode !== current.code
                || nextType !== current.type
                || nextParentId !== current.parentAccountId
                || nextPosting !== current.isPostingAccount
                || nextCurrency !== current.currency
            )
        ) {
            return failedLedgerAccountResult(
                "Used Ledger account accounting identity cannot be changed."
            );
        }

        if (
            nextPosting
            && accounts.some(account =>
                account.parentAccountId === current.id
                && account.status === "active"
            )
        ) {
            return failedLedgerAccountResult(
                "Ledger account with active children cannot become a posting account."
            );
        }

        const updatedAt = new Date().toISOString();
        const updated: LedgerAccount = {
            ...current,
            accountId: context.accountId,
            code: nextCode,
            displayName: input.displayName === undefined
                ? current.displayName
                : input.displayName.trim(),
            type: nextType,
            parentAccountId: nextParentId,
            isPostingAccount: nextPosting,
            currency: nextCurrency,
            notes: input.notes === undefined
                ? current.notes
                : normalizeOptionalText(input.notes),
            updatedAt,
            updatedBy: context.userId
        };
        const errors = this.validator.validate(updated);

        if (errors.length > 0) return failedLedgerAccountResult(errors);

        const saved = this.repository.updateForAccount(
            context.accountId,
            current.id,
            updated
        );

        return saved
            ? successfulLedgerAccountResult(saved)
            : failedLedgerAccountResult("Ledger account not found.");

    }

    public deactivate(
        ledgerAccountId: string,
        reason = "Ledger account deactivated"
    ): LedgerAccountMutationResult {

        const context = this.currentAccountContext();

        if (!context) return failedLedgerAccountResult("Authenticated account is required.");

        const current = this.repository.findForAccount(
            context.accountId,
            ledgerAccountId.trim()
        );

        if (!current) return failedLedgerAccountResult("Ledger account not found.");
        if (current.status === "inactive") return successfulLedgerAccountResult(current);

        const accounts = this.repository.allForAccount(context.accountId);

        if (accounts.some(account =>
            account.parentAccountId === current.id
            && account.status === "active"
        )) {
            return failedLedgerAccountResult(
                "Ledger account with active children cannot be deactivated."
            );
        }

        if (Math.abs(this.usagePolicy.getCurrentBalance(current.id)) > 1e-9) {
            return failedLedgerAccountResult(
                "Ledger account must have zero balance before deactivation."
            );
        }

        const deactivationReason = reason.trim();

        if (!deactivationReason) {
            return failedLedgerAccountResult("Ledger account deactivation reason is required.");
        }

        const deactivatedAt = new Date().toISOString();
        const deactivated: LedgerAccount = {
            ...current,
            accountId: context.accountId,
            status: "inactive",
            deactivatedAt,
            deactivatedBy: context.userId,
            deactivationReason,
            updatedAt: deactivatedAt,
            updatedBy: context.userId
        };
        const errors = this.validator.validate(deactivated);

        if (errors.length > 0) return failedLedgerAccountResult(errors);

        const saved = this.repository.updateForAccount(
            context.accountId,
            current.id,
            deactivated
        );

        return saved
            ? successfulLedgerAccountResult(saved)
            : failedLedgerAccountResult("Ledger account not found.");

    }

    private validateParent(
        accounts: LedgerAccount[],
        parentAccountId: string | undefined,
        type: LedgerAccountType,
        currentAccountId?: string
    ): string | null {

        const normalizedParentId = normalizeOptionalText(parentAccountId);

        if (!normalizedParentId) return null;
        if (normalizedParentId === currentAccountId) return "Ledger account cannot be its own parent.";

        const parent = accounts.find(account => account.id === normalizedParentId);

        if (!parent) return "Parent Ledger account not found.";
        if (parent.status !== "active") return "Parent Ledger account must be active.";
        if (parent.isPostingAccount) return "Posting Ledger account cannot be a parent.";
        if (parent.type !== type) return "Parent and child Ledger account types must match.";

        if (currentAccountId && createsCycle(accounts, currentAccountId, parent.id)) {
            return "Ledger account parent relationship would create a cycle.";
        }

        return null;

    }

    private currentAccountContext(): LedgerAccountContext | null {

        const state = this.authStateService.getState();

        if (state.status !== "authenticated") return null;

        const accountId = state.session.account.id.trim();
        const userAccountId = state.session.user.accountId.trim();
        const userId = state.session.user.id.trim();

        return accountId && accountId === userAccountId && userId
            ? { accountId, userId }
            : null;

    }

}

export interface LedgerAccountMutationResult {
    success: boolean;
    errors: string[];
    account: LedgerAccount | null;
}

export interface LedgerAccountUsagePolicy {
    hasPostedUsage(ledgerAccountId: string): boolean;
    getCurrentBalance(ledgerAccountId: string): number;
}

interface LedgerAccountContext {
    accountId: string;
    userId: string;
}

function successfulLedgerAccountResult(
    account: LedgerAccount
): LedgerAccountMutationResult {
    return { success: true, errors: [], account };
}

function failedLedgerAccountResult(
    errors: string | string[]
): LedgerAccountMutationResult {
    return {
        success: false,
        errors: Array.isArray(errors) ? errors : [errors],
        account: null
    };
}

function hasDuplicateCode(
    accounts: LedgerAccount[],
    code: string,
    excludedId?: string
): boolean {
    return accounts.some(account =>
        account.id !== excludedId
        && account.code.toLocaleLowerCase() === code.toLocaleLowerCase()
    );
}

function createsCycle(
    accounts: LedgerAccount[],
    currentAccountId: string,
    parentAccountId: string
): boolean {
    const visited = new Set<string>();
    let nextId: string | undefined = parentAccountId;
    while (nextId) {
        if (nextId === currentAccountId || visited.has(nextId)) return true;
        visited.add(nextId);
        nextId = accounts.find(account => account.id === nextId)?.parentAccountId;
    }
    return false;
}

function generateLedgerAccountId(): string {
    return typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `ledger-account-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeCode(value: string): string { return value.trim().toUpperCase(); }
function normalizeCurrency(value: string): string { return value.trim().toUpperCase(); }
function normalizeOptionalText(value: string | undefined): string | undefined {
    const normalized = value?.trim() ?? "";
    return normalized || undefined;
}
