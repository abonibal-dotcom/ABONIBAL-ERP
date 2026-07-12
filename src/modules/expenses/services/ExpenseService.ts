import type { AuthStateService } from "../../auth/AuthStateService";
import type {
    Expense,
    ExpenseCategorySnapshot,
    ExpenseDraftInput,
    ExpenseDraftUpdateInput,
    ExpensePayeeSnapshot
} from "../Expense";
import { ExpenseRepository } from "../repositories/ExpenseRepository";
import { ExpenseValidator } from "../validators/ExpenseValidator";

export class ExpenseService {

    private readonly repository: ExpenseRepository;
    private readonly validator: ExpenseValidator;
    private readonly authStateService: AuthStateService;

    public constructor(
        repository: ExpenseRepository,
        validator: ExpenseValidator,
        authStateService: AuthStateService
    ) {

        this.repository = repository;
        this.validator = validator;
        this.authStateService = authStateService;

    }

    public getAll(): Expense[] {

        const accountContext = this.currentAccountContext();

        return accountContext
            ? this.repository.allForAccount(accountContext.accountId)
            : [];

    }

    public find(expenseId: string): Expense | undefined {

        const accountContext = this.currentAccountContext();
        const normalizedExpenseId = expenseId.trim();

        if (!accountContext || !normalizedExpenseId) {
            return undefined;
        }

        return this.repository.findForAccount(
            accountContext.accountId,
            normalizedExpenseId
        );

    }

    public createDraft(input: ExpenseDraftInput): ExpenseMutationResult {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return failedExpenseMutationResult("Authenticated account is required.");
        }

        const createdAt = new Date().toISOString();
        const existingExpenses = this.repository.allForAccount(
            accountContext.accountId
        );
        const expense: Expense = {
            id: generateExpenseId(),
            accountId: accountContext.accountId,
            expenseNumber: normalizeOptionalText(input.expenseNumber)
                ?? generateExpenseNumber(existingExpenses, createdAt),
            status: "draft",
            expenseDate: input.expenseDate.trim(),
            categorySnapshot: normalizeCategorySnapshot(input.categorySnapshot),
            payeeType: input.payeeType,
            payeeId: normalizeOptionalText(input.payeeId),
            payeeSnapshot: normalizePayeeSnapshot(input.payeeSnapshot),
            amount: normalizeAmount(input.amount),
            paymentMethod: input.paymentMethod,
            referenceNumber: normalizeOptionalText(input.referenceNumber),
            notes: normalizeOptionalText(input.notes),
            createdAt,
            createdBy: accountContext.userId,
            updatedAt: createdAt,
            updatedBy: accountContext.userId
        };
        const errors = this.validator.validate(expense);

        if (errors.length > 0) {
            return failedExpenseMutationResult(errors);
        }

        this.repository.appendForAccount(accountContext.accountId, expense);

        return successfulExpenseMutationResult(expense);

    }

    public updateDraft(
        expenseId: string,
        input: ExpenseDraftUpdateInput
    ): ExpenseMutationResult {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return failedExpenseMutationResult("Authenticated account is required.");
        }

        const currentExpense = this.repository.findForAccount(
            accountContext.accountId,
            expenseId.trim()
        );

        if (!currentExpense) {
            return failedExpenseMutationResult("Expense not found.");
        }

        if (currentExpense.status !== "draft") {
            return failedExpenseMutationResult("Only draft expenses can be updated.");
        }

        const updatedAt = new Date().toISOString();
        const updatedExpense: Expense = {
            ...currentExpense,
            accountId: accountContext.accountId,
            expenseDate: input.expenseDate === undefined
                ? currentExpense.expenseDate
                : input.expenseDate.trim(),
            categorySnapshot: input.categorySnapshot === undefined
                ? currentExpense.categorySnapshot
                : normalizeCategorySnapshot(input.categorySnapshot),
            payeeType: input.payeeType ?? currentExpense.payeeType,
            payeeId: input.payeeId === undefined
                ? currentExpense.payeeId
                : normalizeOptionalText(input.payeeId),
            payeeSnapshot: input.payeeSnapshot === undefined
                ? currentExpense.payeeSnapshot
                : normalizePayeeSnapshot(input.payeeSnapshot),
            amount: input.amount === undefined
                ? currentExpense.amount
                : normalizeAmount(input.amount),
            paymentMethod: input.paymentMethod ?? currentExpense.paymentMethod,
            referenceNumber: input.referenceNumber === undefined
                ? currentExpense.referenceNumber
                : normalizeOptionalText(input.referenceNumber),
            notes: input.notes === undefined
                ? currentExpense.notes
                : normalizeOptionalText(input.notes),
            updatedAt,
            updatedBy: accountContext.userId
        };
        const errors = this.validator.validate(updatedExpense);

        if (errors.length > 0) {
            return failedExpenseMutationResult(errors);
        }

        const savedExpense = this.repository.updateForAccount(
            accountContext.accountId,
            currentExpense.id,
            updatedExpense
        );

        return savedExpense
            ? successfulExpenseMutationResult(savedExpense)
            : failedExpenseMutationResult("Expense not found.");

    }

    public post(expenseId: string): ExpenseMutationResult {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return failedExpenseMutationResult("Authenticated account is required.");
        }

        const currentExpense = this.repository.findForAccount(
            accountContext.accountId,
            expenseId.trim()
        );

        if (!currentExpense) {
            return failedExpenseMutationResult("Expense not found.");
        }

        if (currentExpense.status !== "draft") {
            return failedExpenseMutationResult("Only draft expenses can be posted.");
        }

        const postedAt = new Date().toISOString();
        const postedExpense: Expense = {
            ...currentExpense,
            accountId: accountContext.accountId,
            status: "posted",
            postedAt,
            postedBy: accountContext.userId,
            updatedAt: postedAt,
            updatedBy: accountContext.userId
        };
        const errors = this.validator.validate(postedExpense);

        if (errors.length > 0) {
            return failedExpenseMutationResult(errors);
        }

        const savedExpense = this.repository.updateForAccount(
            accountContext.accountId,
            currentExpense.id,
            postedExpense
        );

        return savedExpense
            ? successfulExpenseMutationResult(savedExpense)
            : failedExpenseMutationResult("Expense not found.");

    }

    public voidExpense(
        expenseId: string,
        reason: string
    ): ExpenseMutationResult {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return failedExpenseMutationResult("Authenticated account is required.");
        }

        const currentExpense = this.repository.findForAccount(
            accountContext.accountId,
            expenseId.trim()
        );

        if (!currentExpense) {
            return failedExpenseMutationResult("Expense not found.");
        }

        if (currentExpense.status === "voided") {
            return failedExpenseMutationResult("Expense is already voided.");
        }

        const normalizedReason = reason.trim();

        if (!normalizedReason) {
            return failedExpenseMutationResult("Expense void reason is required.");
        }

        const voidedAt = new Date().toISOString();
        const voidedExpense: Expense = {
            ...currentExpense,
            accountId: accountContext.accountId,
            status: "voided",
            voidedAt,
            voidedBy: accountContext.userId,
            voidReason: normalizedReason,
            updatedAt: voidedAt,
            updatedBy: accountContext.userId
        };
        const errors = this.validator.validate(voidedExpense);

        if (errors.length > 0) {
            return failedExpenseMutationResult(errors);
        }

        const savedExpense = this.repository.updateForAccount(
            accountContext.accountId,
            currentExpense.id,
            voidedExpense
        );

        return savedExpense
            ? successfulExpenseMutationResult(savedExpense)
            : failedExpenseMutationResult("Expense not found.");

    }

    private currentAccountContext(): ExpenseAccountContext | null {

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

export interface ExpenseMutationResult {

    success: boolean;
    errors: string[];
    expense: Expense | null;

}

interface ExpenseAccountContext {

    accountId: string;
    userId: string;

}

function generateExpenseId(): string {

    const cryptoApi = globalThis.crypto;

    return typeof cryptoApi?.randomUUID === "function"
        ? cryptoApi.randomUUID()
        : `expense-${Date.now()}-${Math.random().toString(36).slice(2)}`;

}

function generateExpenseNumber(
    existingExpenses: Expense[],
    timestamp: string
): string {

    const prefix = `EXP-${timestamp.slice(0, 10).replaceAll("-", "")}-`;
    const existingNumbers = new Set(
        existingExpenses.map(expense => expense.expenseNumber)
    );
    let sequence = existingExpenses
        .map(expense => expense.expenseNumber)
        .filter(expenseNumber => expenseNumber.startsWith(prefix))
        .map(expenseNumber => Number(expenseNumber.slice(prefix.length)))
        .filter(Number.isFinite)
        .reduce((max, current) => Math.max(max, current), 0) + 1;
    let expenseNumber = formatExpenseNumber(prefix, sequence);

    while (existingNumbers.has(expenseNumber)) {
        sequence += 1;
        expenseNumber = formatExpenseNumber(prefix, sequence);
    }

    return expenseNumber;

}

function formatExpenseNumber(prefix: string, sequence: number): string {

    return `${prefix}${String(sequence).padStart(4, "0")}`;

}

function normalizeCategorySnapshot(
    snapshot: ExpenseCategorySnapshot
): ExpenseCategorySnapshot {

    return { displayName: snapshot.displayName.trim() };

}

function normalizePayeeSnapshot(
    snapshot: ExpensePayeeSnapshot | null | undefined
): ExpensePayeeSnapshot | null {

    if (!snapshot) {
        return null;
    }

    return { displayName: snapshot.displayName.trim() };

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

function successfulExpenseMutationResult(
    expense: Expense
): ExpenseMutationResult {

    return { success: true, errors: [], expense };

}

function failedExpenseMutationResult(
    errors: string | string[]
): ExpenseMutationResult {

    return {
        success: false,
        errors: Array.isArray(errors) ? errors : [errors],
        expense: null
    };

}
