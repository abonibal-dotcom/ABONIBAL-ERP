import type { LedgerAccountStatus } from "./LedgerAccountStatus";
import type { LedgerAccountType } from "./LedgerAccountType";

export interface LedgerAccount {

    id: string;
    accountId: string;
    code: string;
    displayName: string;
    type: LedgerAccountType;
    parentAccountId?: string;
    isPostingAccount: boolean;
    status: LedgerAccountStatus;
    currency: string;
    notes?: string;
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
    deactivatedAt?: string;
    deactivatedBy?: string;
    deactivationReason?: string;

}

export interface LedgerAccountDraftInput {

    code: string;
    displayName: string;
    type: LedgerAccountType;
    parentAccountId?: string;
    isPostingAccount: boolean;
    currency: string;
    notes?: string;

}

export interface LedgerAccountUpdateInput {

    code?: string;
    displayName?: string;
    type?: LedgerAccountType;
    parentAccountId?: string | null;
    isPostingAccount?: boolean;
    currency?: string;
    notes?: string;

}
