import type { CashMovement } from "../CashMovement";
import { isCashMovementReferenceType } from "../CashMovementReferenceType";
import { isCashMovementStatus } from "../CashMovementStatus";
import { isCashMovementType } from "../CashMovementType";

export class CashMovementValidator {

    public validate(movement: CashMovement): string[] {

        const errors: string[] = [];

        if (!movement.id.trim()) errors.push("Cash movement id is required.");
        if (!movement.accountId.trim()) errors.push("Cash movement accountId is required.");
        if (!movement.movementNumber.trim()) errors.push("Cash movement number is required.");
        if (!movement.safeId.trim()) errors.push("Cash movement safeId is required.");
        if (!movement.safeSnapshot.id.trim()) errors.push("Cash movement Safe snapshot id is required.");
        if (!movement.safeSnapshot.displayName.trim()) errors.push("Cash movement Safe snapshot name is required.");
        if (!isCashMovementType(movement.type)) errors.push("Cash movement type is invalid.");
        if (!isCashMovementStatus(movement.status)) errors.push("Cash movement status is invalid.");

        if (!Number.isFinite(movement.amount) || movement.amount <= 0) {
            errors.push("Cash movement amount must be positive.");
        }

        if (!/^[A-Z]{3}$/.test(movement.currency)) {
            errors.push("Cash movement currency must be a three-letter code.");
        }

        if (movement.safeSnapshot.currency !== movement.currency) {
            errors.push("Cash movement currency must match the Safe snapshot.");
        }

        if (!isValidMovementDate(movement.movementDate)) {
            errors.push("Cash movement date must use YYYY-MM-DD.");
        }

        if (!movement.idempotencyKey.trim()) errors.push("Cash movement idempotencyKey is required.");
        if (!movement.reason.trim()) errors.push("Cash movement reason is required.");

        if (!isCashMovementReferenceType(movement.referenceType)) {
            errors.push("Cash movement referenceType is invalid.");
        }

        if (!movement.createdAt.trim()) errors.push("Cash movement createdAt is required.");
        if (!movement.createdBy.trim()) errors.push("Cash movement createdBy is required.");
        if (!movement.updatedAt.trim()) errors.push("Cash movement updatedAt is required.");
        if (!movement.updatedBy.trim()) errors.push("Cash movement updatedBy is required.");

        if (movement.status === "posted" && (!movement.postedAt || !movement.postedBy)) {
            errors.push("Posted Cash movement requires posting audit metadata.");
        }

        if (
            movement.status === "reversed"
            && (
                !movement.reversedAt
                || !movement.reversedBy
                || !movement.reversedByMovementId
                || !movement.reversalReason
            )
        ) {
            errors.push("Reversed Cash movement requires reversal audit metadata.");
        }

        return errors;

    }

}

function isValidMovementDate(value: string): boolean {

    return /^\d{4}-\d{2}-\d{2}$/.test(value)
        && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));

}
