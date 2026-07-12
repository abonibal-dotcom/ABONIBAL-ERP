import type { AuthStateService } from "../../auth/AuthStateService";
import type {
    CashMovement,
    CashMovementDraftInput,
    CashTransferInput,
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

    public getByTransferId(transferId: string): CashMovement[] {

        const context = this.currentAccountContext();
        const normalizedTransferId = transferId.trim();

        return context && normalizedTransferId
            ? this.repository.getByTransferId(
                context.accountId,
                normalizedTransferId
            )
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

    public createTransfer(input: CashTransferInput): CashTransferResult {

        const context = this.currentAccountContext();

        if (!context) return failedCashTransferResult("Authenticated account is required.");

        const sourceSafeId = input.sourceSafeId.trim();
        const destinationSafeId = input.destinationSafeId.trim();
        const idempotencyKey = input.idempotencyKey.trim();
        const reason = input.reason.trim();

        if (!sourceSafeId || !destinationSafeId) {
            return failedCashTransferResult("Source and destination Safes are required.");
        }

        if (sourceSafeId === destinationSafeId) {
            return failedCashTransferResult("Source and destination Safes must differ.");
        }

        if (!Number.isFinite(input.amount) || input.amount <= 0) {
            return failedCashTransferResult("Transfer amount must be positive.");
        }

        if (!idempotencyKey) {
            return failedCashTransferResult("Transfer idempotencyKey is required.");
        }

        if (!reason) {
            return failedCashTransferResult("Transfer reason is required.");
        }

        const sourceResult = this.resolveActiveSafe(sourceSafeId);
        const destinationResult = this.resolveActiveSafe(destinationSafeId);

        if (!sourceResult.safe) return failedCashTransferResult(sourceResult.errors);
        if (!destinationResult.safe) return failedCashTransferResult(destinationResult.errors);

        if (sourceResult.safe.currency !== destinationResult.safe.currency) {
            return failedCashTransferResult("Transfer Safes must use the same currency.");
        }

        const allMovements = this.repository.allForAccount(context.accountId);
        const existing = allMovements.filter(
            movement => movement.idempotencyKey === idempotencyKey
        );

        if (existing.length > 0) {
            if (isEquivalentTransfer(existing, input)) {
                return successfulCashTransferResult(existing, true);
            }

            return failedCashTransferResult(
                "Transfer idempotencyKey already exists with different data."
            );
        }

        if (this.calculateCurrentBalance(sourceSafeId) < input.amount) {
            return failedCashTransferResult(
                "Transfer would make the source Safe balance negative."
            );
        }

        const transferId = generateTransferId();
        const now = new Date().toISOString();
        const transferOut = buildTransferMovement({
            movements: allMovements,
            accountId: context.accountId,
            userId: context.userId,
            safe: sourceResult.safe,
            type: "transfer_out",
            amount: input.amount,
            movementDate: input.movementDate.trim(),
            idempotencyKey,
            reason,
            notes: input.notes,
            transferId,
            now
        });
        const transferIn = buildTransferMovement({
            movements: [...allMovements, transferOut],
            accountId: context.accountId,
            userId: context.userId,
            safe: destinationResult.safe,
            type: "transfer_in",
            amount: input.amount,
            movementDate: input.movementDate.trim(),
            idempotencyKey,
            reason,
            notes: input.notes,
            transferId,
            now
        });
        const errors = [
            ...this.validator.validate(transferOut),
            ...this.validator.validate(transferIn)
        ];

        if (errors.length > 0) return failedCashTransferResult(errors);

        try {
            this.repository.saveAllForAccount(
                context.accountId,
                [...allMovements, transferOut, transferIn]
            );
        } catch {
            return failedCashTransferResult("Transfer could not be stored atomically.");
        }

        return successfulCashTransferResult([transferOut, transferIn]);

    }

    public reverseTransfer(
        transferId: string,
        reason: string
    ): CashTransferResult {

        const context = this.currentAccountContext();

        if (!context) return failedCashTransferResult("Authenticated account is required.");

        const normalizedTransferId = transferId.trim();
        const normalizedReason = reason.trim();

        if (!normalizedTransferId) return failedCashTransferResult("Transfer id is required.");
        if (!normalizedReason) return failedCashTransferResult("Transfer reversal reason is required.");

        const allMovements = this.repository.allForAccount(context.accountId);
        const originals = allMovements.filter(
            movement => movement.transferId === normalizedTransferId
        );

        if (!isCompleteTransferPair(originals)) {
            return failedCashTransferResult("Complete transfer pair was not found.");
        }

        const originalOut = originals.find(
            movement => movement.type === "transfer_out"
        )!;
        const originalIn = originals.find(
            movement => movement.type === "transfer_in"
        )!;
        const existingReversals = allMovements.filter(
            movement => movement.reversalOfMovementId === originalOut.id
                || movement.reversalOfMovementId === originalIn.id
        );

        if (originals.every(movement => movement.status === "reversed")) {
            return isCompleteTransferPair(existingReversals)
                ? successfulCashTransferResult(existingReversals, true)
                : failedCashTransferResult("Reversed transfer audit pair is incomplete.");
        }

        if (originals.some(movement => movement.status !== "posted")) {
            return failedCashTransferResult("Only a posted complete transfer can be reversed.");
        }

        if (originals.some(movement => movement.reversalOfMovementId)) {
            return failedCashTransferResult("A transfer reversal cannot be reversed directly.");
        }

        const reversalSourceResult = this.resolveActiveSafe(originalIn.safeId);
        const reversalDestinationResult = this.resolveActiveSafe(originalOut.safeId);

        if (!reversalSourceResult.safe) {
            return failedCashTransferResult(reversalSourceResult.errors);
        }

        if (!reversalDestinationResult.safe) {
            return failedCashTransferResult(reversalDestinationResult.errors);
        }

        if (
            reversalSourceResult.safe.currency
            !== reversalDestinationResult.safe.currency
        ) {
            return failedCashTransferResult("Transfer Safes must use the same currency.");
        }

        if (
            this.calculateCurrentBalance(reversalSourceResult.safe.id)
            < originalOut.amount
        ) {
            return failedCashTransferResult(
                "Transfer reversal would make the source Safe balance negative."
            );
        }

        const reversalTransferId = generateTransferId();
        const now = new Date().toISOString();
        const idempotencyKey = `transfer-reversal:${normalizedTransferId}`;
        const reversalOut = buildTransferMovement({
            movements: allMovements,
            accountId: context.accountId,
            userId: context.userId,
            safe: reversalSourceResult.safe,
            type: "transfer_out",
            amount: originalOut.amount,
            movementDate: todayDate(),
            idempotencyKey,
            reason: normalizedReason,
            transferId: reversalTransferId,
            now,
            referenceType: "reversal",
            referenceId: normalizedTransferId,
            reversalOfMovementId: originalIn.id
        });
        const reversalIn = buildTransferMovement({
            movements: [...allMovements, reversalOut],
            accountId: context.accountId,
            userId: context.userId,
            safe: reversalDestinationResult.safe,
            type: "transfer_in",
            amount: originalOut.amount,
            movementDate: todayDate(),
            idempotencyKey,
            reason: normalizedReason,
            transferId: reversalTransferId,
            now,
            referenceType: "reversal",
            referenceId: normalizedTransferId,
            reversalOfMovementId: originalOut.id
        });
        const reversedOriginals = originals.map(movement => ({
            ...movement,
            status: "reversed" as const,
            reversedByMovementId: movement.id === originalOut.id
                ? reversalIn.id
                : reversalOut.id,
            reversedAt: now,
            reversedBy: context.userId,
            reversalReason: normalizedReason,
            updatedAt: now,
            updatedBy: context.userId
        }));
        const nextMovements = allMovements.map(movement =>
            reversedOriginals.find(original => original.id === movement.id)
                ?? movement
        );
        const errors = [
            ...reversedOriginals.flatMap(movement =>
                this.validator.validate(movement)
            ),
            ...this.validator.validate(reversalOut),
            ...this.validator.validate(reversalIn)
        ];

        if (errors.length > 0) return failedCashTransferResult(errors);

        try {
            this.repository.saveAllForAccount(
                context.accountId,
                [...nextMovements, reversalOut, reversalIn]
            );
        } catch {
            return failedCashTransferResult(
                "Transfer reversal could not be stored atomically."
            );
        }

        return successfulCashTransferResult([reversalOut, reversalIn]);

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

export interface CashTransferResult {

    success: boolean;
    errors: string[];
    movements: CashMovement[];
    idempotentReplay: boolean;

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

function successfulCashTransferResult(
    movements: CashMovement[],
    idempotentReplay = false
): CashTransferResult {

    return {
        success: true,
        errors: [],
        movements,
        idempotentReplay
    };

}

function failedCashTransferResult(
    errors: string | string[]
): CashTransferResult {

    return {
        success: false,
        errors: Array.isArray(errors) ? errors : [errors],
        movements: [],
        idempotentReplay: false
    };

}

function snapshotSafe(safe: Safe) {
    return { id: safe.id, displayName: safe.displayName, currency: safe.currency };
}

interface TransferMovementBuildInput {
    movements: CashMovement[];
    accountId: string;
    userId: string;
    safe: Safe;
    type: "transfer_in" | "transfer_out";
    amount: number;
    movementDate: string;
    idempotencyKey: string;
    reason: string;
    notes?: string;
    transferId: string;
    now: string;
    referenceType?: CashMovement["referenceType"];
    referenceId?: string;
    reversalOfMovementId?: string;
}

function buildTransferMovement(
    input: TransferMovementBuildInput
): CashMovement {

    return {
        id: generateCashMovementId(),
        accountId: input.accountId,
        movementNumber: generateMovementNumber(input.movements, input.now),
        safeId: input.safe.id,
        safeSnapshot: snapshotSafe(input.safe),
        type: input.type,
        status: "posted",
        amount: input.amount,
        currency: input.safe.currency,
        movementDate: input.movementDate,
        idempotencyKey: input.idempotencyKey,
        reason: input.reason,
        referenceType: input.referenceType ?? "transfer",
        referenceId: input.referenceId ?? input.transferId,
        notes: normalizeOptionalText(input.notes),
        reversalOfMovementId: input.reversalOfMovementId,
        transferId: input.transferId,
        createdAt: input.now,
        createdBy: input.userId,
        updatedAt: input.now,
        updatedBy: input.userId,
        postedAt: input.now,
        postedBy: input.userId
    };

}

function isCompleteTransferPair(movements: CashMovement[]): boolean {

    return movements.length === 2
        && movements.filter(movement => movement.type === "transfer_out").length === 1
        && movements.filter(movement => movement.type === "transfer_in").length === 1
        && movements[0].transferId === movements[1].transferId
        && movements[0].amount === movements[1].amount
        && movements[0].currency === movements[1].currency;

}

function isEquivalentTransfer(
    movements: CashMovement[],
    input: CashTransferInput
): boolean {

    if (!isCompleteTransferPair(movements)) return false;

    const transferOut = movements.find(
        movement => movement.type === "transfer_out"
    )!;
    const transferIn = movements.find(
        movement => movement.type === "transfer_in"
    )!;

    return transferOut.safeId === input.sourceSafeId.trim()
        && transferIn.safeId === input.destinationSafeId.trim()
        && transferOut.amount === input.amount
        && transferOut.movementDate === input.movementDate.trim();

}

function generateTransferId(): string {

    return `transfer:${generateCashMovementId()}`;

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
