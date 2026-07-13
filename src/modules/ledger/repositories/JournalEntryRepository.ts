import type { Driver } from "../../../core/persistence/Driver";
import { Repository } from "../../../core/repositories/Repository";
import type { JournalEntry } from "../JournalEntry";
import { isJournalEntryStatus } from "../JournalEntryStatus";
import type { JournalLine } from "../JournalLine";
import { isLedgerAccountType } from "../LedgerAccountType";
import { isJournalSourceType } from "../JournalSourceType";
import { journalEntryStorageKeyForAccount } from "../persistence/JournalEntryPersistenceKey";

export class JournalEntryRepository extends Repository<JournalEntry> {

    public constructor(driver: Driver) {

        super("ledgerEntries", driver);

    }

    public allForAccount(accountId: string): JournalEntry[] {

        const stored = this.driver.read<unknown[]>(
            journalEntryStorageKeyForAccount(accountId)
        );

        return Array.isArray(stored) ? stored.filter(isJournalEntry) : [];

    }

    public saveAllForAccount(accountId: string, entries: JournalEntry[]): void {

        this.driver.write<JournalEntry[]>(
            journalEntryStorageKeyForAccount(accountId),
            entries
        );

    }

    public appendForAccount(accountId: string, entry: JournalEntry): void {

        const entries = this.allForAccount(accountId);
        entries.push(entry);
        this.saveAllForAccount(accountId, entries);

    }

    public findForAccount(
        accountId: string,
        entryId: string
    ): JournalEntry | undefined {

        return this.allForAccount(accountId).find(entry => entry.id === entryId);

    }

    public findByIdempotencyKey(
        accountId: string,
        idempotencyKey: string
    ): JournalEntry | undefined {

        return this.allForAccount(accountId).find(
            entry => entry.idempotencyKey === idempotencyKey
        );

    }

    public getBySource(
        accountId: string,
        sourceType: JournalEntry["sourceType"],
        sourceId: string,
        sourceEvent?: string
    ): JournalEntry[] {

        return this.allForAccount(accountId).filter(entry =>
            entry.sourceType === sourceType
            && entry.sourceId === sourceId
            && (sourceEvent === undefined || entry.sourceEvent === sourceEvent)
        );

    }

    public updateForAccount(
        accountId: string,
        entryId: string,
        entry: JournalEntry
    ): JournalEntry | null {

        const entries = this.allForAccount(accountId);
        const index = entries.findIndex(item => item.id === entryId);

        if (index === -1) return null;

        entries[index] = entry;
        this.saveAllForAccount(accountId, entries);

        return entry;

    }

}

function isJournalEntry(value: unknown): value is JournalEntry {

    if (!value || typeof value !== "object") return false;

    const entry = value as Partial<JournalEntry>;

    return isNonEmptyString(entry.id)
        && isNonEmptyString(entry.accountId)
        && isNonEmptyString(entry.journalNumber)
        && isJournalEntryStatus(entry.status)
        && isValidDate(entry.entryDate)
        && isCurrency(entry.currency)
        && isNonEmptyString(entry.description)
        && isJournalSourceType(entry.sourceType)
        && isNonEmptyString(entry.idempotencyKey)
        && Array.isArray(entry.lines)
        && entry.lines.every(isJournalLine)
        && isNonEmptyString(entry.createdAt)
        && isNonEmptyString(entry.createdBy)
        && isNonEmptyString(entry.updatedAt)
        && isNonEmptyString(entry.updatedBy);

}

function isJournalLine(value: unknown): value is JournalLine {

    if (!value || typeof value !== "object") return false;

    const line = value as Partial<JournalLine>;
    const snapshot = line.accountSnapshot;

    return isNonEmptyString(line.id)
        && isNonEmptyString(line.ledgerAccountId)
        && !!snapshot
        && isNonEmptyString(snapshot.code)
        && isNonEmptyString(snapshot.displayName)
        && isLedgerAccountType(snapshot.type)
        && isCurrency(snapshot.currency)
        && isNonNegativeFiniteNumber(line.debit)
        && isNonNegativeFiniteNumber(line.credit);

}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isCurrency(value: unknown): value is string {
    return typeof value === "string" && /^[A-Z]{3}$/.test(value);
}

function isValidDate(value: unknown): value is string {
    return typeof value === "string"
        && /^\d{4}-\d{2}-\d{2}$/.test(value)
        && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}
