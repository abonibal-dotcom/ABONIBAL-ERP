import type { Driver } from "../../../core/persistence/Driver";
import { Repository } from "../../../core/repositories/Repository";
import type { LedgerAccount } from "../LedgerAccount";
import { isLedgerAccountStatus } from "../LedgerAccountStatus";
import { isLedgerAccountType } from "../LedgerAccountType";
import { ledgerAccountStorageKeyForAccount } from "../persistence/LedgerAccountPersistenceKey";

export class LedgerAccountRepository extends Repository<LedgerAccount> {

    public constructor(driver: Driver) {

        super("ledgerAccounts", driver);

    }

    public allForAccount(accountId: string): LedgerAccount[] {

        const stored = this.driver.read<unknown[]>(
            ledgerAccountStorageKeyForAccount(accountId)
        );

        return Array.isArray(stored) ? stored.filter(isLedgerAccount) : [];

    }

    public saveAllForAccount(
        accountId: string,
        accounts: LedgerAccount[]
    ): void {

        this.driver.write<LedgerAccount[]>(
            ledgerAccountStorageKeyForAccount(accountId),
            accounts
        );

    }

    public appendForAccount(accountId: string, account: LedgerAccount): void {

        const accounts = this.allForAccount(accountId);
        accounts.push(account);
        this.saveAllForAccount(accountId, accounts);

    }

    public findForAccount(
        accountId: string,
        ledgerAccountId: string
    ): LedgerAccount | undefined {

        return this.allForAccount(accountId).find(
            account => account.id === ledgerAccountId
        );

    }

    public updateForAccount(
        accountId: string,
        ledgerAccountId: string,
        account: LedgerAccount
    ): LedgerAccount | null {

        const accounts = this.allForAccount(accountId);
        const index = accounts.findIndex(item => item.id === ledgerAccountId);

        if (index === -1) return null;

        accounts[index] = account;
        this.saveAllForAccount(accountId, accounts);

        return account;

    }

}

function isLedgerAccount(value: unknown): value is LedgerAccount {

    if (!value || typeof value !== "object") return false;

    const account = value as Partial<LedgerAccount>;

    return isNonEmptyString(account.id)
        && isNonEmptyString(account.accountId)
        && isNonEmptyString(account.code)
        && isNonEmptyString(account.displayName)
        && isLedgerAccountType(account.type)
        && typeof account.isPostingAccount === "boolean"
        && isLedgerAccountStatus(account.status)
        && isCurrency(account.currency)
        && isNonEmptyString(account.createdAt)
        && isNonEmptyString(account.createdBy)
        && isNonEmptyString(account.updatedAt)
        && isNonEmptyString(account.updatedBy);

}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function isCurrency(value: unknown): value is string {
    return typeof value === "string" && /^[A-Z]{3}$/.test(value);
}
