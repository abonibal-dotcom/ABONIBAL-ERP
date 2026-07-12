import { Repository } from "../../../core/repositories/Repository";
import type { Driver } from "../../../core/persistence/Driver";
import type { CashMovement } from "../CashMovement";
import { isCashMovementReferenceType } from "../CashMovementReferenceType";
import { isCashMovementStatus } from "../CashMovementStatus";
import { isCashMovementType } from "../CashMovementType";
import { cashMovementStorageKeyForAccount } from "../persistence/CashMovementPersistenceKey";

export class CashMovementRepository extends Repository<CashMovement> {

    public constructor(driver: Driver) {

        super("cashMovements", driver);

    }

    public allForAccount(accountId: string): CashMovement[] {

        const storedMovements = this.driver.read<unknown[]>(
            cashMovementStorageKeyForAccount(accountId)
        );

        if (!Array.isArray(storedMovements)) {
            return [];
        }

        return storedMovements.filter(isCashMovement);

    }

    public saveAllForAccount(
        accountId: string,
        movements: CashMovement[]
    ): void {

        this.driver.write<CashMovement[]>(
            cashMovementStorageKeyForAccount(accountId),
            movements
        );

    }

    public appendForAccount(
        accountId: string,
        movement: CashMovement
    ): void {

        const movements = this.allForAccount(accountId);

        movements.push(movement);
        this.saveAllForAccount(accountId, movements);

    }

    public findForAccount(
        accountId: string,
        movementId: string
    ): CashMovement | undefined {

        return this
            .allForAccount(accountId)
            .find(movement => movement.id === movementId);

    }

    public findByIdempotencyKey(
        accountId: string,
        idempotencyKey: string
    ): CashMovement | undefined {

        return this
            .allForAccount(accountId)
            .find(movement => movement.idempotencyKey === idempotencyKey);

    }

    public getBySafeId(
        accountId: string,
        safeId: string
    ): CashMovement[] {

        return this
            .allForAccount(accountId)
            .filter(movement => movement.safeId === safeId);

    }

    public updateForAccount(
        accountId: string,
        movementId: string,
        movement: CashMovement
    ): CashMovement | null {

        const movements = this.allForAccount(accountId);
        const movementIndex = movements.findIndex(
            currentMovement => currentMovement.id === movementId
        );

        if (movementIndex === -1) {
            return null;
        }

        movements[movementIndex] = movement;
        this.saveAllForAccount(accountId, movements);

        return movement;

    }

}

function isCashMovement(value: unknown): value is CashMovement {

    if (!value || typeof value !== "object") {
        return false;
    }

    const movement = value as Partial<CashMovement>;
    const safeSnapshot = movement.safeSnapshot;

    return isNonEmptyString(movement.id)
        && isNonEmptyString(movement.accountId)
        && isNonEmptyString(movement.movementNumber)
        && isNonEmptyString(movement.safeId)
        && !!safeSnapshot
        && isNonEmptyString(safeSnapshot.id)
        && isNonEmptyString(safeSnapshot.displayName)
        && isCurrency(safeSnapshot.currency)
        && isCashMovementType(movement.type)
        && isCashMovementStatus(movement.status)
        && isPositiveFiniteNumber(movement.amount)
        && isCurrency(movement.currency)
        && isValidDate(movement.movementDate)
        && isNonEmptyString(movement.idempotencyKey)
        && isNonEmptyString(movement.reason)
        && isCashMovementReferenceType(movement.referenceType)
        && isNonEmptyString(movement.createdAt)
        && isNonEmptyString(movement.createdBy)
        && isNonEmptyString(movement.updatedAt)
        && isNonEmptyString(movement.updatedBy);

}

function isNonEmptyString(value: unknown): value is string {

    return typeof value === "string" && value.trim().length > 0;

}

function isPositiveFiniteNumber(value: unknown): value is number {

    return typeof value === "number" && Number.isFinite(value) && value > 0;

}

function isCurrency(value: unknown): value is string {

    return typeof value === "string" && /^[A-Z]{3}$/.test(value);

}

function isValidDate(value: unknown): value is string {

    return typeof value === "string"
        && /^\d{4}-\d{2}-\d{2}$/.test(value)
        && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));

}
