import type { LedgerAccountType } from "./LedgerAccountType";

export interface JournalLineAccountSnapshot {

    code: string;
    displayName: string;
    type: LedgerAccountType;
    currency: string;

}

export interface JournalLine {

    id: string;
    ledgerAccountId: string;
    accountSnapshot: JournalLineAccountSnapshot;
    debit: number;
    credit: number;
    description?: string;
    partyType?: "customer" | "supplier" | "other";
    partyId?: string;
    partySnapshot?: Record<string, unknown>;
    metadata?: Record<string, unknown>;

}

export interface JournalLineInput {

    ledgerAccountId: string;
    debit: number;
    credit: number;
    description?: string;
    partyType?: "customer" | "supplier" | "other";
    partyId?: string;
    partySnapshot?: Record<string, unknown>;
    metadata?: Record<string, unknown>;

}
