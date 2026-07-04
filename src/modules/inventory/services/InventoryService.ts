import type { AuthStateService } from "../../auth/AuthStateService";
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

    public constructor(
        repository: StockMovementRepository,
        validator: StockMovementValidator,
        authStateService: AuthStateService
    ) {

        this.repository = repository;
        this.validator = validator;
        this.authStateService = authStateService;

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

interface InventoryAccountContext {

    accountId: string;
    userId: string;

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
