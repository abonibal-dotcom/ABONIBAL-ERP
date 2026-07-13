import type { LedgerAccount } from "../LedgerAccount";
import { isLedgerAccountStatus } from "../LedgerAccountStatus";
import { isLedgerAccountType } from "../LedgerAccountType";

export class LedgerAccountValidator {

    public validate(account: LedgerAccount): string[] {

        const errors: string[] = [];

        if (!account.id.trim()) errors.push("Ledger account id is required.");
        if (!account.accountId.trim()) errors.push("Ledger account accountId is required.");
        if (!account.code.trim()) errors.push("Ledger account code is required.");
        if (!account.displayName.trim()) errors.push("Ledger account displayName is required.");
        if (!isLedgerAccountType(account.type)) errors.push("Ledger account type is invalid.");
        if (!isLedgerAccountStatus(account.status)) errors.push("Ledger account status is invalid.");
        if (!/^[A-Z]{3}$/.test(account.currency)) errors.push("Ledger account currency must be a three-letter code.");
        if (account.parentAccountId === account.id) errors.push("Ledger account cannot be its own parent.");
        if (!account.createdAt.trim()) errors.push("Ledger account createdAt is required.");
        if (!account.createdBy.trim()) errors.push("Ledger account createdBy is required.");
        if (!account.updatedAt.trim()) errors.push("Ledger account updatedAt is required.");
        if (!account.updatedBy.trim()) errors.push("Ledger account updatedBy is required.");

        if (
            account.status === "inactive"
            && (!account.deactivatedAt || !account.deactivatedBy || !account.deactivationReason)
        ) {
            errors.push("Inactive Ledger account requires deactivation audit metadata.");
        }

        return errors;

    }

}
