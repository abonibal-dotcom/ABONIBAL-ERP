import { Repository } from "../../../core/repositories/Repository";
import type { Driver } from "../../../core/persistence/Driver";
import type { StockMovement } from "../StockMovement";
import {
    isStockMovementReferenceType,
    isStockMovementType
} from "../StockMovementType";
import { stockMovementStorageKeyForAccount } from "../persistence/StockMovementPersistenceKey";

export class StockMovementRepository extends Repository<StockMovement> {

    public constructor(driver: Driver) {

        super("stockMovements", driver);

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
    ): void {

        const movements = this.allForAccount(accountId);

        movements.push(movement);

        this.saveForAccount(accountId, movements);

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

    public voidForAccount(
        accountId: string,
        movementId: string,
        voidMetadata: StockMovementVoidMetadata
    ): StockMovement | null {

        const movements = this.allForAccount(accountId);
        const movementIndex = movements.findIndex(
            movement => movement.id === movementId
        );

        if (movementIndex === -1) {
            return null;
        }

        const voidedMovement: StockMovement = {
            ...movements[movementIndex],
            voidedAt: voidMetadata.voidedAt,
            voidedBy: voidMetadata.voidedBy,
            voidReason: voidMetadata.voidReason,
            updatedAt: voidMetadata.voidedAt,
            updatedBy: voidMetadata.voidedBy
        };

        movements[movementIndex] = voidedMovement;

        this.saveForAccount(accountId, movements);

        return voidedMovement;

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

export interface StockMovementVoidMetadata {

    voidedAt: string;
    voidedBy: string;
    voidReason: string;

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
