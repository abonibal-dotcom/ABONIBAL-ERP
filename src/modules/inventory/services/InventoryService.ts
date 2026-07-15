import type { AuthStateService } from "../../auth/AuthStateService";
import type { ProductService } from "../../products/services/ProductService";
import {
    buildStockMovementReversalIdentity,
    IMMUTABLE_STOCK_MOVEMENT_SEMANTICS_VERSION,
    isLegacyVoidedStockMovement,
    isReversalStockMovement,
    stockMovementInventoryEffect,
    type StockMovement,
    type StockMovementInput
} from "../StockMovement";
import type {
    StockMovementType
} from "../StockMovementType";
import type { StockMovementRepositoryPort } from "../repositories/StockMovementRepository";
import { StockMovementValidator } from "../validators/StockMovementValidator";

export class InventoryService {

    private readonly repository: StockMovementRepositoryPort;
    private readonly validator: StockMovementValidator;
    private readonly authStateService: AuthStateService;
    private readonly productService: ProductService;

    public constructor(
        repository: StockMovementRepositoryPort,
        validator: StockMovementValidator,
        authStateService: AuthStateService,
        productService: ProductService
    ) {

        this.repository = repository;
        this.validator = validator;
        this.authStateService = authStateService;
        this.productService = productService;

    }

    public getAll(): StockMovement[] {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return [];
        }

        return this.repository.allForAccount(accountContext.accountId);

    }

    public addMovement(input: StockMovementInput): StockMovementResult {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return failedStockMovementResult(
                "Authenticated account is required."
            );
        }

        if (input.type === "reversal") {
            return failedStockMovementResult(
                "Use reverseMovement to create a reversal stock movement."
            );
        }

        const movement: StockMovement = {
            id: crypto.randomUUID(),
            accountId: accountContext.accountId,
            productId: input.productId.trim(),
            type: input.type,
            quantityDelta: input.quantityDelta,
            reason: input.reason.trim(),
            referenceType: input.referenceType,
            referenceId: input.referenceId?.trim(),
            unitCost: input.unitCost,
            totalCost: input.totalCost,
            createdAt: new Date().toISOString(),
            createdBy: accountContext.userId,
            ledgerSemanticsVersion:
                IMMUTABLE_STOCK_MOVEMENT_SEMANTICS_VERSION,
            metadata: input.metadata
        };
        const errors = this.validator.validate(movement);

        if (errors.length > 0) {
            return failedStockMovementResult(errors);
        }

        let storedMovement: StockMovement;

        try {
            storedMovement = this.repository.appendForAccount(
                accountContext.accountId,
                movement
            );
        } catch (error) {
            return failedStockMovementResult(safeInventoryError(error));
        }

        return {
            success: true,
            errors: [],
            movement: storedMovement
        };

    }

    public addOpeningBalanceForNewProduct(
        productId: string,
        quantity: number
    ): StockMovementResult {

        const normalizedProductId = productId.trim();

        if (!normalizedProductId) {
            return failedStockMovementResult("Product id is required.");
        }

        if (!Number.isFinite(quantity) || quantity <= 0) {
            return failedStockMovementResult(
                "Opening quantity must be a positive number."
            );
        }

        const existingMovement = this
            .getByProductId(normalizedProductId)
            .find(movement =>
                !isLegacyVoidedStockMovement(movement)
                && movement.type === "opening_balance"
                && movement.referenceType === "opening_balance"
                && movement.referenceId === normalizedProductId
                && movement.metadata?.source === "product_create"
            );

        if (existingMovement) {
            return {
                success: true,
                errors: [],
                movement: existingMovement
            };
        }

        return this.addMovement({
            productId: normalizedProductId,
            type: "opening_balance",
            quantityDelta: quantity,
            reason: "Opening stock created with product.",
            referenceType: "opening_balance",
            referenceId: normalizedProductId,
            metadata: {
                source: "product_create"
            }
        });

    }

    public getByProductId(productId: string): StockMovement[] {

        const accountContext = this.currentAccountContext();
        const normalizedProductId = productId.trim();

        if (!accountContext || !normalizedProductId) {
            return [];
        }

        return this.repository.allForProduct(
            accountContext.accountId,
            normalizedProductId
        );

    }

    public getCurrentQuantity(productId: string): number {

        return sumStockMovementEffects(
            this.getByProductId(productId)
        );

    }

    public getCurrentQuantities(): Record<string, number> {

        const quantities: Record<string, number> = {};

        for (const movement of this.getAll()) {

            quantities[movement.productId] =
                (quantities[movement.productId] ?? 0)
                + stockMovementInventoryEffect(movement);

        }

        return quantities;

    }

    public getAvailableQuantity(productId: string): number {

        const normalizedProductId = productId.trim();

        if (
            !this.currentAccountContext()
            || !normalizedProductId
            || !this.productService.find(normalizedProductId)
        ) {
            return 0;
        }

        return this.getCurrentQuantity(normalizedProductId);

    }

    public checkAvailability(
        productId: string,
        requestedQuantity: number
    ): StockAvailabilityResult {

        const accountContext = this.currentAccountContext();
        const normalizedProductId = productId.trim();

        if (!accountContext) {
            return failedStockAvailabilityResult(
                normalizedProductId,
                requestedQuantity,
                "unauthenticated",
                "Authenticated account is required."
            );
        }

        if (!normalizedProductId) {
            return failedStockAvailabilityResult(
                normalizedProductId,
                requestedQuantity,
                "invalid_product",
                "Product id is required."
            );
        }

        if (!isValidRequestedQuantity(requestedQuantity)) {
            return failedStockAvailabilityResult(
                normalizedProductId,
                requestedQuantity,
                "invalid_requested_quantity",
                "Requested quantity must be a positive number."
            );
        }

        if (!this.productService.find(normalizedProductId)) {
            return failedStockAvailabilityResult(
                normalizedProductId,
                requestedQuantity,
                "invalid_product",
                "Product is not available for stock fulfillment."
            );
        }

        const availableQuantity = this.getCurrentQuantity(normalizedProductId);
        const shortageQuantity = Math.max(
            0,
            requestedQuantity - availableQuantity
        );

        return {
            productId: normalizedProductId,
            requestedQuantity,
            availableQuantity,
            canFulfill: shortageQuantity === 0,
            shortageQuantity,
            status: shortageQuantity === 0
                ? "fulfilled"
                : "insufficient_stock",
            errors: []
        };

    }

    public checkAvailabilityBatch(
        items: StockAvailabilityInput[]
    ): StockAvailabilityBatchResult {

        const aggregatedRequests = new Map<string, number>();
        const invalidResults: StockAvailabilityResult[] = [];

        for (const item of items) {

            const normalizedProductId = item.productId.trim();

            if (
                !normalizedProductId
                || !isValidRequestedQuantity(item.requestedQuantity)
            ) {
                invalidResults.push(
                    this.checkAvailability(
                        normalizedProductId,
                        item.requestedQuantity
                    )
                );
                continue;
            }

            aggregatedRequests.set(
                normalizedProductId,
                (aggregatedRequests.get(normalizedProductId) ?? 0)
                    + item.requestedQuantity
            );

        }

        const results = [
            ...invalidResults,
            ...Array.from(aggregatedRequests.entries()).map(
                ([itemProductId, itemRequestedQuantity]) =>
                    this.checkAvailability(
                        itemProductId,
                        itemRequestedQuantity
                    )
            )
        ];

        return {
            canFulfill:
                results.length > 0
                && results.every(result => result.canFulfill),
            results
        };

    }

    public voidMovement(
        movementId: string,
        reason: string
    ): StockMovementResult {

        return this.reverseMovement(movementId, reason);

    }

    public reverseMovement(
        movementId: string,
        reason: string
    ): StockMovementResult {

        const accountContext = this.currentAccountContext();
        const normalizedMovementId = movementId.trim();
        const normalizedReason = reason.trim();

        if (!accountContext) {
            return failedStockMovementResult(
                "Authenticated account is required."
            );
        }

        if (!normalizedMovementId) {
            return failedStockMovementResult(
                "Stock movement id is required."
            );
        }

        if (!normalizedReason) {
            return failedStockMovementResult(
                "Stock movement void reason is required."
            );
        }

        const currentMovement = this.repository.findForAccount(
            accountContext.accountId,
            normalizedMovementId
        );

        if (!currentMovement) {
            return failedStockMovementResult(
                "Stock movement not found."
            );
        }

        if (isReversalStockMovement(currentMovement)) {
            return failedStockMovementResult(
                "Reversal stock movement cannot be reversed."
            );
        }

        if (currentMovement.voidedAt) {
            return failedStockMovementResult(
                "Legacy voided stock movement cannot be reversed again."
            );
        }

        if (!isGenericReversalEligible(currentMovement.type)) {
            return failedStockMovementResult(
                "Stock movement is owned by another domain or is not reversible."
            );
        }

        if (
            !Number.isFinite(currentMovement.quantityDelta)
            || currentMovement.quantityDelta === 0
        ) {
            return failedStockMovementResult(
                "Stock movement effect must be finite and non-zero."
            );
        }

        const identity = buildStockMovementReversalIdentity(
            currentMovement.id
        );

        if (!identity) {
            return failedStockMovementResult(
                "Stock movement id is not eligible for deterministic reversal."
            );
        }

        const existingReversals = this.repository.reversalsForAccount(
            accountContext.accountId,
            currentMovement.id
        );

        if (existingReversals.length > 1) {
            return failedStockMovementResult(
                "Multiple reversal movements found for the original movement."
            );
        }

        const existingReversal = existingReversals[0];

        if (existingReversal) {
            return isMatchingReversal(
                existingReversal,
                currentMovement,
                normalizedReason,
                identity.movementId,
                identity.idempotencyKey
            )
                ? {
                    success: true,
                    errors: [],
                    movement: existingReversal
                }
                : failedStockMovementResult(
                    "Stock movement is already reversed with different reversal data."
                );
        }

        if (this.repository.findForAccount(
            accountContext.accountId,
            identity.movementId
        )) {
            return failedStockMovementResult(
                "Deterministic reversal movement id is already in use."
            );
        }

        const reversalMovement: StockMovement = {
            id: identity.movementId,
            accountId: accountContext.accountId,
            productId: currentMovement.productId,
            type: "reversal",
            quantityDelta: -currentMovement.quantityDelta,
            reason: normalizedReason,
            referenceType: "movement_reversal",
            referenceId: currentMovement.id,
            unitCost: currentMovement.unitCost,
            totalCost: currentMovement.totalCost === undefined
                ? undefined
                : -currentMovement.totalCost,
            createdAt: new Date().toISOString(),
            createdBy: accountContext.userId,
            ledgerSemanticsVersion:
                IMMUTABLE_STOCK_MOVEMENT_SEMANTICS_VERSION,
            reversalOfMovementId: currentMovement.id,
            reversalReason: normalizedReason,
            idempotencyKey: identity.idempotencyKey,
            metadata: {
                source: "stock_movement_reversal",
                originalMovementType: currentMovement.type
            }
        };
        const errors = this.validator.validate(reversalMovement);

        if (errors.length > 0) {
            return failedStockMovementResult(errors);
        }

        let storedReversal: StockMovement;

        try {
            storedReversal = this.repository.appendForAccount(
                accountContext.accountId,
                reversalMovement
            );
        } catch (error) {
            return failedStockMovementResult(safeInventoryError(error));
        }

        return {
            success: true,
            errors: [],
            movement: storedReversal
        };

    }

    private currentAccountContext(): InventoryAccountContext | null {

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

export interface StockMovementResult {

    success: boolean;
    errors: string[];
    movement: StockMovement | null;

}

export interface StockAvailabilityInput {

    productId: string;
    requestedQuantity: number;

}

export interface StockAvailabilityResult {

    productId: string;
    requestedQuantity: number;
    availableQuantity: number;
    canFulfill: boolean;
    shortageQuantity: number;
    status: StockAvailabilityStatus;
    errors: string[];

}

export interface StockAvailabilityBatchResult {

    canFulfill: boolean;
    results: StockAvailabilityResult[];

}

export type StockAvailabilityStatus =
    | "fulfilled"
    | "insufficient_stock"
    | "invalid_product"
    | "invalid_requested_quantity"
    | "unauthenticated";

interface InventoryAccountContext {

    accountId: string;
    userId: string;

}

function failedStockAvailabilityResult(
    productId: string,
    requestedQuantity: number,
    status: StockAvailabilityStatus,
    error: string
): StockAvailabilityResult {

    const shortageQuantity = isValidRequestedQuantity(requestedQuantity)
        ? requestedQuantity
        : 0;

    return {
        productId,
        requestedQuantity,
        availableQuantity: 0,
        canFulfill: false,
        shortageQuantity,
        status,
        errors: [error]
    };

}

function isValidRequestedQuantity(value: number): boolean {

    return Number.isFinite(value) && value > 0;

}

function failedStockMovementResult(
    errors: string | string[]
): StockMovementResult {

    return {
        success: false,
        errors: Array.isArray(errors) ? errors : [errors],
        movement: null
    };

}

function sumStockMovementEffects(movements: StockMovement[]): number {

    return movements.reduce(
        (total, movement) =>
            total + stockMovementInventoryEffect(movement),
        0
    );

}

function isGenericReversalEligible(type: StockMovementType): boolean {

    return type === "opening_balance"
        || type === "manual_adjustment"
        || type === "correction";

}

function isMatchingReversal(
    reversal: StockMovement,
    original: StockMovement,
    reason: string,
    movementId: string,
    idempotencyKey: string
): boolean {

    return reversal.id === movementId
        && reversal.accountId === original.accountId
        && reversal.productId === original.productId
        && reversal.type === "reversal"
        && reversal.quantityDelta === -original.quantityDelta
        && reversal.referenceType === "movement_reversal"
        && reversal.referenceId === original.id
        && reversal.reversalOfMovementId === original.id
        && reversal.reversalReason === reason
        && reversal.reason === reason
        && reversal.idempotencyKey === idempotencyKey
        && reversal.ledgerSemanticsVersion === 2;

}

function safeInventoryError(error: unknown): string {

    return error instanceof Error && error.message.trim()
        ? error.message
        : "Stock movement persistence failed.";

}
