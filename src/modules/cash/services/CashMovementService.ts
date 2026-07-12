import type { AuthStateService } from "../../auth/AuthStateService";
import type {
    CashMovement,
    CashMovementDraftInput,
    CashMovementUpdateInput
} from "../CashMovement";
import {
    isCashMovementInflow,
    isCashMovementTransfer,
    oppositeCashMovementType
} from "../CashMovementType";
import { CashMovementRepository } from "../repositories/CashMovementRepository";
import { CashMovementValidator } from "../validators/CashMovementValidator";
import type { Safe } from "../Safe";
import { SafeService } from "./SafeService";

export class CashMovementService {

    private readonly repository: CashMovementRepository;
    private readonly validator: CashMovementValidator;
    private readonly authStateService: AuthStateService;
    private readonly safeService: SafeService;

    public constructor(
        repository: CashMovementRepository,
        validator: CashMovementValidator,
        authStateService: AuthStateService,
        safeService: SafeService
    ) {

        this.repository = repository;
        this.validator = validator;
        this.authStateService = authStateService;
        this.safeService = safeService;

    }

    public getAll(): CashMovement[] {

        const context = this.currentAccountContext();

        return context
            ? this.repository.allForAccount(context.accountId)
            : [];

    }

    public find(movementId: string): CashMovement | undefined {

        const context = this.currentAccountContext();

        return context
            ? this.repository.findForAccount(context.accountId, movementId.trim())
            : undefined;

    }

    public getBySafeId(safeId: string): CashMovement[] {

        const context = this.currentAccountContext();
        const normalizedSafeId = safeId.trim();

        return context && normalizedSafeId
            ? this.repository.getBySafeId(context.accountId, normalizedSafeId)
            : [];

    }

    public createDraft(input: CashMovementDraftInput): CashMovementMutationResult {

        const context = this.currentAccountContext();

        if (!context) return failedCashMovementResult("Authenticated account is required.");
        if (isCashMovementTransfer(input.type)) {
            return failedCashMovementResult("Transfer movements require the atomic transfer service.");
        }

        const safeResult = this.resolveActiveSafe(input.safeId);

        if (!safeResult.safe) return failedCashMovementResult(safeResult.errors);

        const existingMovements = this.repository.allForAccount(context.accountId);
        const now = new Date().toISOString();
        const idempotencyKey = normalizeOptionalText(input.idempotencyKey)
            ?? generateIdempotencyKey();

        if (existingMovements.some(movement => movement.idempotencyKey === idempotencyKey)) {
            return failedCashMovementResult("Cash movement idempotencyKey already exists.");
        }

        const movement: CashMovement = {
            id: generateCashMovementId(),
            accountId: context.accountId,
            movementNumber: generateMovementNumber(existingMovements, now),
            safeId: safeResult.safe.id,
            safeSnapshot: snapshotSafe(safeResult.safe),
            type: input.type,
            status: "draft",
            amount: normalizeAmount(input.amount),
            currency: safeResult.safe.currency,
            movementDate: input.movementDate.trim(),
            idempotencyKey,
            reason: input.reason.trim(),
            referenceType: input.referenceType ?? defaultReferenceType(input.type),
            referenceId: normalizeOptionalText(input.referenceId),
            referenceSnapshot: input.referenceSnapshot,
            metadata: input.metadata,
            notes: normalizeOptionalText(input.notes),
            createdAt: now,
            createdBy: context.userId,
            updatedAt: now,
            updatedBy: context.userId
        };
        const errors = this.validator.validate(movement);

        if (errors.length > 0) return failedCashMovementResult(errors);

        this.repository.appendForAccount(context.accountId, movement);

        return successfulCashMovementResult(movement);

    }

    public updateDraft(
        movementId: string,
        input: CashMovementUpdateInput
    ): CashMovementMutationResult {

        const context = this.currentAccountContext();

        if (!context) return failedCashMovementResult("Authenticated account is required.");

        const current = this.repository.findForAccount(context.accountId, movementId.trim());

        if (!current) return failedCashMovementResult("Cash movement not found.");
        if (current.status !== "draft") return failedCashMovementResult("Only draft Cash movements can be updated.");

        const nextType = input.type ?? current.type;

        if (isCashMovementTransfer(nextType)) {
            return failedCashMovementResult("Transfer movements require the atomic transfer service.");
        }

        const safeResult = this.resolveActiveSafe(input.safeId ?? current.safeId);

        if (!safeResult.safe) return failedCashMovementResult(safeResult.errors);

        const updatedAt = new Date().toISOString();
        const updated: CashMovement = {
            ...current,
            accountId: context.accountId,
            safeId: safeResult.safe.id,
            safeSnapshot: snapshotSafe(safeResult.safe),
            type: nextType,
            amount: input.amount === undefined ? current.amount : normalizeAmount(input.amount),
            currency: safeResult.safe.currency,
            movementDate: input.movementDate === undefined ? current.movementDate : input.movementDate.trim(),
            reason: input.reason === undefined ? current.reason : input.reason.trim(),
            referenceType: input.referenceType ?? current.referenceType,
            referenceId: input.referenceId === undefined ? current.referenceId : normalizeOptionalText(input.referenceId),
            referenceSnapshot: input.referenceSnapshot === undefined ? current.referenceSnapshot : input.referenceSnapshot,
            metadata: input.metadata === undefined ? current.metadata : input.metadata,
            notes: input.notes === undefined ? current.notes : normalizeOptionalText(input.notes),
            updatedAt,
            updatedBy: context.userId
        };
        const errors = this.validator.validate(updated);

        if (errors.length > 0) return failedCashMovementResult(errors);

        const saved = this.repository.updateForAccount(context.accountId, current.id, updated);

        return saved
            ? successfulCashMovementResult(saved)
            : failedCashMovementResult("Cash movement not found.");

    }

    public post(movementId: string): CashMovementMutationResult {

        const context = this.currentAccountContext();

        if (!context) return failedCashMovementResult("Authenticated account is required.");

        const current = this.repository.findForAccount(context.accountId, movementId.trim());

        if (!current) return failedCashMovementResult("Cash movement not found.");
        if (current.status !== "draft") return failedCashMovementResult("Only draft Cash movements can be posted.");
        if (isCashMovementTransfer(current.type)) {
            return failedCashMovementResult("Transfer movements require the atomic transfer service.");
        }

        const safeResult = this.resolveActiveSafe(current.safeId);

        if (!safeResult.safe) return failedCashMovementResult(safeResult.errors);
        if (safeResult.safe.currency !== current.currency) {
            return failedCashMovementResult("Cash movement currency does not match the Safe.");
        }

        const allMovements = this.repository.allForAccount(context.accountId);

        if (allMovements.some(movement =>
            movement.id !== current.id
            && movement.idempotencyKey === current.idempotencyKey
            && movement.status !== "draft"
        )) {
            return failedCashMovementResult("Cash movement financial effect already exists.");
        }

        if (
            current.type === "opening_balance"
            && allMovements.some(movement =>
                movement.id !== current.id
                && movement.safeId === current.safeId
                && movement.type === "opening_balance"
                && movement.status !== "draft"
            )
        ) {
            return failedCashMovementResult("Safe already has a posted opening balance.");
        }

        if (
            !isCashMovementInflow(current.type)
            && this.calculateCurrentBalance(current.safeId) < current.amount
        ) {
            return failedCashMovementResult("Cash movement would make the Safe balance negative.");
        }

        const postedAt = new Date().toISOString();
        const posted: CashMovement = {
            ...current,
            accountId: context.accountId,
            status: "posted",
            postedAt,
            postedBy: context.userId,
            updatedAt: postedAt,
            updatedBy: context.userId
        };
        const errors = this.validator.validate(posted);

        if (errors.length > 0) return failedCashMovementResult(errors);

        const saved = this.repository.updateForAccount(context.accountId, current.id, posted);

        return saved
            ? successfulCashMovementResult(saved)
            : failedCashMovementResult("Cash movement not found.");

    }

    public reverse(
        movementId: string,
        reason: string
    ): CashMovementMutationResult {

        const context = this.currentAccountContext();

        if (!context) return failedCashMovementResult("Authenticated account is required.");

        const current = this.repository.findForAccount(context.accountId, movementId.trim());
        const normalizedReason = reason.trim();

        if (!current) return failedCashMovementResult("Cash movement not found.");
        if (current.status !== "posted") return failedCashMovementResult("Only posted Cash movements can be reversed.");
        if (!normalizedReason) return failedCashMovementResult("Cash movement reversal reason is required.");
        if (current.reversalOfMovementId) return failedCashMovementResult("A reversal movement cannot be reversed directly.");
        if (isCashMovementTransfer(current.type)) {
            return failedCashMovementResult("Transfers must be reversed as one atomic operation.");
        }

        const safeResult = this.resolveActiveSafe(current.safeId);

        if (!safeResult.safe) return failedCashMovementResult(safeResult.errors);

        const allMovements = this.repository.allForAccount(context.accountId);

        if (allMovements.some(movement => movement.reversalOfMovementId === current.id)) {
            return failedCashMovementResult("Cash movement is already reversed.");
        }

        const reversalType = oppositeCashMovementType(current.type);

        if (
            !isCashMovementInflow(reversalType)
            && this.calculateCurrentBalance(current.safeId) < current.amount
        ) {
            return failedCashMovementResult("Reversal would make the Safe balance negative.");
        }

        const now = new Date().toISOString();
        const reversal: CashMovement = {
            id: generateCashMovementId(),
            accountId: context.accountId,
            movementNumber: generateMovementNumber(allMovements, now),
            safeId: current.safeId,
            safeSnapshot: current.safeSnapshot,
            type: reversalType,
            status: "posted",
            amount: current.amount,
            currency: current.currency,
            movementDate: todayDate(),
            idempotencyKey: `reversal:${current.id}`,
            reason: normalizedReason,
            referenceType: "reversal",
            referenceId: current.id,
            referenceSnapshot: { movementNumber: current.movementNumber },
            reversalOfMovementId: current.id,
            createdAt: now,
            createdBy: context.userId,
            updatedAt: now,
            updatedBy: context.userId,
            postedAt: now,
            postedBy: context.userId
        };
        const reversed: CashMovement = {
            ...current,
            status: "reversed",
            reversedByMovementId: reversal.id,
            reversedAt: now,
            reversedBy: context.userId,
            reversalReason: normalizedReason,
            updatedAt: now,
            updatedBy: context.userId
        };
        const errors = [
            ...this.validator.validate(reversal),
            ...this.validator.validate(reversed)
        ];

        if (errors.length > 0) return failedCashMovementResult(errors);

        const nextMovements = allMovements.map(movement =>
            movement.id === reversed.id ? reversed : movement
        );

        nextMovements.push(reversal);
        this.repository.saveAllForAccount(context.accountId, nextMovements);

        return successfulCashMovementResult(reversed, reversal);

    }

    public calculateCurrentBalance(safeId: string): number {

        return sumBalance(this.getBySafeId(safeId));

    }

    public calculateBalanceAtDate(safeId: string, date: string): number {

        const normalizedDate = date.trim();

        if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) return 0;

        return sumBalance(
            this.getBySafeId(safeId).filter(
                movement => movement.movementDate <= normalizedDate
            )
        );

    }

    public hasPostedMovementForSafe(safeId: string): boolean {

        return this.getBySafeId(safeId).some(
            movement => movement.status === "posted" || movement.status === "reversed"
        );

    }

    private resolveActiveSafe(safeId: string): SafeResolutionResult {

        const safe = this.safeService.find(safeId.trim());

        if (!safe) return { safe: null, errors: ["Safe not found."] };
        if (safe.status !== "active") return { safe: null, errors: ["Cash movement requires an active Safe."] };

        return { safe, errors: [] };

    }

    private currentAccountContext(): CashMovementAccountContext | null {

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

export interface CashMovementMutationResult {

    success: boolean;
    errors: string[];
    movement: CashMovement | null;
    relatedMovement: CashMovement | null;

}

interface CashMovementAccountContext {
    accountId: string;
    userId: string;
}

interface SafeResolutionResult {
    safe: Safe | null;
    errors: string[];
}

function successfulCashMovementResult(
    movement: CashMovement,
    relatedMovement: CashMovement | null = null
): CashMovementMutationResult {
    return { success: true, errors: [], movement, relatedMovement };
}

function failedCashMovementResult(
    errors: string | string[]
): CashMovementMutationResult {
    return {
        success: false,
        errors: Array.isArray(errors) ? errors : [errors],
        movement: null,
        relatedMovement: null
    };
}

function snapshotSafe(safe: Safe) {
    return { id: safe.id, displayName: safe.displayName, currency: safe.currency };
}

function sumBalance(movements: CashMovement[]): number {
    return movements.reduce((balance, movement) => {
        if (movement.status === "draft") return balance;
        const signedAmount = isCashMovementInflow(movement.type)
            ? movement.amount
            : -movement.amount;
        return balance + signedAmount;
    }, 0);
}

function defaultReferenceType(type: CashMovement["type"]): CashMovement["referenceType"] {
    if (type === "opening_balance") return "opening_balance";
    if (type === "adjustment_in" || type === "adjustment_out") return "adjustment";
    return "manual";
}

function generateCashMovementId(): string {
    return typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `cash-movement-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function generateIdempotencyKey(): string {
    return `cash-command:${generateCashMovementId()}`;
}

function generateMovementNumber(movements: CashMovement[], timestamp: string): string {
    const prefix = `CASH-${timestamp.slice(0, 10).replaceAll("-", "")}-`;
    const numbers = new Set(movements.map(movement => movement.movementNumber));
    let sequence = movements
        .map(movement => movement.movementNumber)
        .filter(number => number.startsWith(prefix))
        .map(number => Number(number.slice(prefix.length)))
        .filter(Number.isFinite)
        .reduce((maximum, current) => Math.max(maximum, current), 0) + 1;
    let number = `${prefix}${String(sequence).padStart(4, "0")}`;
    while (numbers.has(number)) {
        sequence += 1;
        number = `${prefix}${String(sequence).padStart(4, "0")}`;
    }
    return number;
}

function normalizeAmount(value: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
    const normalized = value?.trim() ?? "";
    return normalized || undefined;
}

function todayDate(): string {
    return new Date().toISOString().slice(0, 10);
}
