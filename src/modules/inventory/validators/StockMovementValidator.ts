import type { StockMovement } from "../StockMovement";
import {
    isStockMovementReferenceType,
    isStockMovementType
} from "../StockMovementType";

export class StockMovementValidator {

    public validate(movement: StockMovement): string[] {

        const errors: string[] = [];

        if (!movement.id.trim()) {
            errors.push("Stock movement id is required.");
        }

        if (!movement.accountId.trim()) {
            errors.push("Stock movement accountId is required.");
        }

        if (!movement.productId.trim()) {
            errors.push("Stock movement productId is required.");
        }

        if (!isStockMovementType(movement.type)) {
            errors.push("Stock movement type is invalid.");
        }

        if (!Number.isFinite(movement.quantityDelta)) {
            errors.push("Stock movement quantityDelta must be numeric.");
        }

        if (!movement.reason.trim()) {
            errors.push("Stock movement reason is required.");
        }

        if (!isStockMovementReferenceType(movement.referenceType)) {
            errors.push("Stock movement referenceType is invalid.");
        }

        if (!movement.createdAt.trim()) {
            errors.push("Stock movement createdAt is required.");
        }

        if (!movement.createdBy.trim()) {
            errors.push("Stock movement createdBy is required.");
        }

        if (
            movement.unitCost !== undefined
            && !Number.isFinite(movement.unitCost)
        ) {
            errors.push("Stock movement unitCost must be numeric.");
        }

        if (
            movement.totalCost !== undefined
            && !Number.isFinite(movement.totalCost)
        ) {
            errors.push("Stock movement totalCost must be numeric.");
        }

        return errors;

    }

}
