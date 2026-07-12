import { Repository } from "../../../core/repositories/Repository";
import type { Driver } from "../../../core/persistence/Driver";
import type { Safe } from "../Safe";
import { isSafeStatus } from "../SafeStatus";
import { safeStorageKeyForAccount } from "../persistence/SafePersistenceKey";

export class SafeRepository extends Repository<Safe> {

    public constructor(driver: Driver) {

        super("safes", driver);

    }

    public allForAccount(accountId: string): Safe[] {

        const storedSafes = this.driver.read<unknown[]>(
            safeStorageKeyForAccount(accountId)
        );

        if (!Array.isArray(storedSafes)) {
            return [];
        }

        return storedSafes.filter(isSafe);

    }

    public saveAllForAccount(accountId: string, safes: Safe[]): void {

        this.driver.write<Safe[]>(
            safeStorageKeyForAccount(accountId),
            safes
        );

    }

    public appendForAccount(accountId: string, safe: Safe): void {

        const safes = this.allForAccount(accountId);

        safes.push(safe);
        this.saveAllForAccount(accountId, safes);

    }

    public findForAccount(
        accountId: string,
        safeId: string
    ): Safe | undefined {

        return this
            .allForAccount(accountId)
            .find(safe => safe.id === safeId);

    }

    public updateForAccount(
        accountId: string,
        safeId: string,
        safe: Safe
    ): Safe | null {

        const safes = this.allForAccount(accountId);
        const safeIndex = safes.findIndex(
            currentSafe => currentSafe.id === safeId
        );

        if (safeIndex === -1) {
            return null;
        }

        safes[safeIndex] = safe;
        this.saveAllForAccount(accountId, safes);

        return safe;

    }

}

function isSafe(value: unknown): value is Safe {

    if (!value || typeof value !== "object") {
        return false;
    }

    const safe = value as Partial<Safe>;

    return isNonEmptyString(safe.id)
        && isNonEmptyString(safe.accountId)
        && isNonEmptyString(safe.displayName)
        && isCurrency(safe.currency)
        && isSafeStatus(safe.status)
        && typeof safe.isDefault === "boolean"
        && isNonEmptyString(safe.createdAt)
        && isNonEmptyString(safe.createdBy)
        && isNonEmptyString(safe.updatedAt)
        && isNonEmptyString(safe.updatedBy);

}

function isNonEmptyString(value: unknown): value is string {

    return typeof value === "string" && value.trim().length > 0;

}

function isCurrency(value: unknown): value is string {

    return typeof value === "string" && /^[A-Z]{3}$/.test(value);

}
