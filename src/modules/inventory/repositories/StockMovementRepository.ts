import type { Driver } from "../../../core/persistence/Driver";
import {
    isReversalStockMovement,
    type StockMovement
} from "../StockMovement";
import {
    isStockMovementReferenceType,
    isStockMovementType
} from "../StockMovementType";
import { stockMovementStorageKeyForAccount } from "../persistence/StockMovementPersistenceKey";

export class StockMovementRepository {

    private readonly driver: Driver;

    public constructor(driver: Driver) {

        this.driver = driver;

    }

    public allForAccount(accountId: string): StockMovement[] {

        const storedMovements = this.driver.read<unknown[]>(
            stockMovementStorageKeyForAccount(accountId)
        );

        if (!Array.isArray(storedMovements)) {
            return [];
        }

        return storedMovements.filter(isStockMovement);

    }

    public appendForAccount(
        accountId: string,
        movement: StockMovement
    ): StockMovement {

        if (movement.accountId !== accountId) {
            throw new Error("Stock movement account mismatch.");
        }

        const movements = this.allForAccount(accountId);
        const existingMovement = movements.find(
            currentMovement => currentMovement.id === movement.id
        );

        if (existingMovement) {
            if (areStockMovementsEquivalent(existingMovement, movement)) {
                return existingMovement;
            }

            throw new Error("Stock movement immutable identity conflict.");
        }

        movements.push(movement);

        this.saveForAccount(accountId, movements);

        return movement;

    }

    public findForAccount(
        accountId: string,
        movementId: string
    ): StockMovement | undefined {

        return this
            .allForAccount(accountId)
            .find(movement => movement.id === movementId);

    }

    public allForProduct(
        accountId: string,
        productId: string
    ): StockMovement[] {

        return this
            .allForAccount(accountId)
            .filter(movement => movement.productId === productId);

    }

    public reversalsForAccount(
        accountId: string,
        originalMovementId: string
    ): StockMovement[] {

        return this
            .allForAccount(accountId)
            .filter(movement =>
                isReversalStockMovement(movement)
                && movement.reversalOfMovementId === originalMovementId
            );

    }

    private saveForAccount(
        accountId: string,
        movements: StockMovement[]
    ): void {

        this.driver.write<StockMovement[]>(
            stockMovementStorageKeyForAccount(accountId),
            movements
        );

    }

}

function isStockMovement(value: unknown): value is StockMovement {

    if (!value || typeof value !== "object") {
        return false;
    }

    const movement = value as Partial<StockMovement>;

    return isNonEmptyString(movement.id)
        && isNonEmptyString(movement.accountId)
        && isNonEmptyString(movement.productId)
        && isStockMovementType(movement.type)
        && Number.isFinite(movement.quantityDelta)
        && isNonEmptyString(movement.reason)
        && isStockMovementReferenceType(movement.referenceType)
        && isNonEmptyString(movement.createdAt)
        && isNonEmptyString(movement.createdBy);

}

function isNonEmptyString(value: unknown): value is string {

    return typeof value === "string" && value.trim().length > 0;

}

function areStockMovementsEquivalent(
    left: StockMovement,
    right: StockMovement
): boolean {

    return JSON.stringify(canonicalize(left))
        === JSON.stringify(canonicalize(right));

}

function canonicalize(value: unknown): unknown {

    if (Array.isArray(value)) {
        return value.map(canonicalize);
    }

    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value)
                .filter(([, child]) => child !== undefined)
                .sort(([leftKey], [rightKey]) =>
                    leftKey.localeCompare(rightKey)
                )
                .map(([key, child]) => [key, canonicalize(child)])
        );
    }

    return value;

}
