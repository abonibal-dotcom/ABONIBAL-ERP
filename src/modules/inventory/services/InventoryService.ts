import type { AuthStateService } from "../../auth/AuthStateService";
import type { ProductService } from "../../products/services/ProductService";
import type {
    StockMovement,
    StockMovementInput
} from "../StockMovement";
import { StockMovementRepository } from "../repositories/StockMovementRepository";
import { StockMovementValidator } from "../validators/StockMovementValidator";

export class InventoryService {

    private readonly repository: StockMovementRepository;
    private readonly validator: StockMovementValidator;
    private readonly authStateService: AuthStateService;
    private readonly productService: ProductService;

    public constructor(
        repository: StockMovementRepository,
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
            metadata: input.metadata
        };
        const errors = this.validator.validate(movement);

        if (errors.length > 0) {
            return failedStockMovementResult(errors);
        }

        this.repository.appendForAccount(
            accountContext.accountId,
            movement
        );

        return {
            success: true,
            errors: [],
            movement
        };

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

        return sumNonVoidedQuantityDelta(
            this.getByProductId(productId)
        );

    }

    public getCurrentQuantities(): Record<string, number> {

        const quantities: Record<string, number> = {};

        for (const movement of this.getAll()) {

            if (movement.voidedAt) {
                continue;
            }

            quantities[movement.productId] =
                (quantities[movement.productId] ?? 0)
                + movement.quantityDelta;

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

        if (currentMovement.voidedAt) {
            return failedStockMovementResult(
                "Stock movement is already voided."
            );
        }

        const voidedMovement = this.repository.voidForAccount(
            accountContext.accountId,
            normalizedMovementId,
            {
                voidedAt: new Date().toISOString(),
                voidedBy: accountContext.userId,
                voidReason: normalizedReason
            }
        );

        if (!voidedMovement) {
            return failedStockMovementResult(
                "Stock movement not found."
            );
        }

        return {
            success: true,
            errors: [],
            movement: voidedMovement
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

function sumNonVoidedQuantityDelta(movements: StockMovement[]): number {

    return movements.reduce(
        (total, movement) => movement.voidedAt
            ? total
            : total + movement.quantityDelta,
        0
    );

}
