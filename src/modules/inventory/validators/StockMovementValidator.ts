import {
    buildStockMovementReversalIdentity,
    type StockMovement
} from "../StockMovement";
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

        if (
            movement.ledgerSemanticsVersion !== undefined
            && movement.ledgerSemanticsVersion !== 2
        ) {
            errors.push("Stock movement ledger semantics version is invalid.");
        }

        if (
            movement.ledgerSemanticsVersion === 2
            && hasLegacyVoidMetadata(movement)
        ) {
            errors.push("Immutable stock movement cannot contain legacy void metadata.");
        }

        if (
            movement.idempotencyKey !== undefined
            && !movement.idempotencyKey.trim()
        ) {
            errors.push("Stock movement idempotency key cannot be empty.");
        }

        if (movement.type === "reversal") {
            this.validateReversal(movement, errors);
        } else if (hasReversalFields(movement)) {
            errors.push("Non-reversal stock movement cannot contain reversal fields.");
        }

        return errors;

    }

    private validateReversal(
        movement: StockMovement,
        errors: string[]
    ): void {

        if (movement.ledgerSemanticsVersion !== 2) {
            errors.push("Reversal movement must use immutable ledger semantics version 2.");
        }

        const originalMovementId = movement.reversalOfMovementId?.trim() ?? "";
        const reversalReason = movement.reversalReason?.trim() ?? "";
        const idempotencyKey = movement.idempotencyKey?.trim() ?? "";
        const identity = buildStockMovementReversalIdentity(originalMovementId);

        if (!originalMovementId) {
            errors.push("Reversal original movement id is required.");
        }

        if (!reversalReason) {
            errors.push("Reversal reason is required.");
        }

        if (!Number.isFinite(movement.quantityDelta) || movement.quantityDelta === 0) {
            errors.push("Reversal quantityDelta must be non-zero.");
        }

        if (movement.referenceType !== "movement_reversal") {
            errors.push("Reversal referenceType must be movement_reversal.");
        }

        if (movement.referenceId !== originalMovementId) {
            errors.push("Reversal referenceId must match the original movement id.");
        }

        if (!identity) {
            errors.push("Reversal original movement id is not key-safe.");
            return;
        }

        if (movement.id !== identity.movementId) {
            errors.push("Reversal movement id is not deterministic.");
        }

        if (idempotencyKey !== identity.idempotencyKey) {
            errors.push("Reversal idempotency key is invalid.");
        }

    }

}

function hasLegacyVoidMetadata(movement: StockMovement): boolean {

    return movement.voidedAt !== undefined
        || movement.voidedBy !== undefined
        || movement.voidReason !== undefined;

}

function hasReversalFields(movement: StockMovement): boolean {

    return movement.reversalOfMovementId !== undefined
        || movement.reversalReason !== undefined;

}
