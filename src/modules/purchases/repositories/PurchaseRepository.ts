import { Repository } from "../../../core/repositories/Repository";
import type { Driver } from "../../../core/persistence/Driver";
import type { Purchase, PurchaseLine } from "../Purchase";
import { isPurchaseStatus } from "../PurchaseStatus";
import { purchaseStorageKeyForAccount } from "../persistence/PurchasePersistenceKey";

export class PurchaseRepository extends Repository<Purchase> {

    public constructor(driver: Driver) {

        super("purchases", driver);

    }

    public allForAccount(accountId: string): Purchase[] {

        const storedPurchases = this.driver.read<unknown[]>(
            purchaseStorageKeyForAccount(accountId)
        );

        if (!Array.isArray(storedPurchases)) {
            return [];
        }

        return storedPurchases.filter(isPurchase);

    }

    public appendForAccount(accountId: string, purchase: Purchase): void {

        const purchases = this.allForAccount(accountId);

        purchases.push(purchase);

        this.saveForAccount(accountId, purchases);

    }

    public findForAccount(
        accountId: string,
        purchaseId: string
    ): Purchase | undefined {

        return this
            .allForAccount(accountId)
            .find(purchase => purchase.id === purchaseId);

    }

    public updateForAccount(
        accountId: string,
        purchaseId: string,
        purchase: Purchase
    ): Purchase | null {

        const purchases = this.allForAccount(accountId);
        const purchaseIndex = purchases.findIndex(
            currentPurchase => currentPurchase.id === purchaseId
        );

        if (purchaseIndex === -1) {
            return null;
        }

        purchases[purchaseIndex] = purchase;

        this.saveForAccount(accountId, purchases);

        return purchase;

    }

    private saveForAccount(accountId: string, purchases: Purchase[]): void {

        this.driver.write<Purchase[]>(
            purchaseStorageKeyForAccount(accountId),
            purchases
        );

    }

}

function isPurchase(value: unknown): value is Purchase {

    if (!value || typeof value !== "object") {
        return false;
    }

    const purchase = value as Partial<Purchase>;

    return isNonEmptyString(purchase.id)
        && isNonEmptyString(purchase.accountId)
        && isNonEmptyString(purchase.purchaseNumber)
        && isPurchaseStatus(purchase.status)
        && isNullableRecord(purchase.supplierSnapshot)
        && Array.isArray(purchase.lines)
        && purchase.lines.every(isPurchaseLine)
        && isFiniteNumber(purchase.subtotal)
        && isFiniteNumber(purchase.discount)
        && isFiniteNumber(purchase.tax)
        && isFiniteNumber(purchase.total)
        && isNonEmptyString(purchase.createdAt)
        && isNonEmptyString(purchase.createdBy)
        && isNonEmptyString(purchase.updatedAt)
        && isNonEmptyString(purchase.updatedBy);

}

function isPurchaseLine(value: unknown): value is PurchaseLine {

    if (!value || typeof value !== "object") {
        return false;
    }

    const line = value as Partial<PurchaseLine>;

    return isNonEmptyString(line.id)
        && isNonEmptyString(line.productNameSnapshot)
        && isFiniteNumber(line.quantity)
        && isFiniteNumber(line.unitCost)
        && isFiniteNumber(line.discount)
        && isFiniteNumber(line.tax)
        && isFiniteNumber(line.lineSubtotal)
        && isFiniteNumber(line.lineTotal);

}

function isNonEmptyString(value: unknown): value is string {

    return typeof value === "string" && value.trim().length > 0;

}

function isFiniteNumber(value: unknown): value is number {

    return typeof value === "number" && Number.isFinite(value);

}

function isNullableRecord(
    value: unknown
): value is Record<string, unknown> | null {

    return value === null
        || (
            typeof value === "object"
            && !Array.isArray(value)
        );

}
