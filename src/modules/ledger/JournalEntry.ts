import type { JournalEntryStatus } from "./JournalEntryStatus";
import type { JournalLine, JournalLineInput } from "./JournalLine";
import type { JournalSourceType } from "./JournalSourceType";

export interface JournalEntry {

    id: string;
    accountId: string;
    journalNumber: string;
    status: JournalEntryStatus;
    entryDate: string;
    currency: string;
    description: string;
    sourceType: JournalSourceType;
    sourceId?: string;
    sourceEvent?: string;
    sourceSnapshot?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    idempotencyKey: string;
    lines: JournalLine[];
    reversalOfEntryId?: string;
    reversedByEntryId?: string;
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
    postedAt?: string;
    postedBy?: string;
    reversedAt?: string;
    reversedBy?: string;
    reversalReason?: string;

}

export interface JournalEntryDraftInput {

    entryDate: string;
    currency: string;
    description: string;
    sourceType?: JournalSourceType;
    sourceId?: string;
    sourceEvent?: string;
    sourceSnapshot?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    idempotencyKey?: string;
    lines: JournalLineInput[];

}

export interface JournalEntryUpdateInput {

    entryDate?: string;
    currency?: string;
    description?: string;
    sourceType?: JournalSourceType;
    sourceId?: string;
    sourceEvent?: string;
    sourceSnapshot?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    lines?: JournalLineInput[];

}
