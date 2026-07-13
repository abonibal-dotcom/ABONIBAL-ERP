import type { JournalEntry } from "../JournalEntry";
import { isJournalEntryStatus } from "../JournalEntryStatus";
import type { JournalLine } from "../JournalLine";
import { isJournalSourceType } from "../JournalSourceType";

export class JournalEntryValidator {

    public validate(entry: JournalEntry): string[] {

        const errors: string[] = [];

        if (!entry.id.trim()) errors.push("Journal entry id is required.");
        if (!entry.accountId.trim()) errors.push("Journal entry accountId is required.");
        if (!entry.journalNumber.trim()) errors.push("Journal entry number is required.");
        if (!isJournalEntryStatus(entry.status)) errors.push("Journal entry status is invalid.");
        if (!isValidDate(entry.entryDate)) errors.push("Journal entry date must use YYYY-MM-DD.");
        if (!/^[A-Z]{3}$/.test(entry.currency)) errors.push("Journal entry currency must be a three-letter code.");
        if (!entry.description.trim()) errors.push("Journal entry description is required.");
        if (!isJournalSourceType(entry.sourceType)) errors.push("Journal entry sourceType is invalid.");
        if (!entry.idempotencyKey.trim()) errors.push("Journal entry idempotencyKey is required.");
        if (entry.lines.length < 2) errors.push("Journal entry requires at least two lines.");

        for (const line of entry.lines) {
            errors.push(...validateLine(line, entry.currency));
        }

        const totals = journalEntryTotals(entry);

        if (!amountsEqual(totals.debit, totals.credit)) {
            errors.push("Journal entry debit and credit totals must be equal.");
        }

        if (totals.debit <= 0 || totals.credit <= 0) {
            errors.push("Journal entry totals must be positive.");
        }

        if (!entry.createdAt.trim()) errors.push("Journal entry createdAt is required.");
        if (!entry.createdBy.trim()) errors.push("Journal entry createdBy is required.");
        if (!entry.updatedAt.trim()) errors.push("Journal entry updatedAt is required.");
        if (!entry.updatedBy.trim()) errors.push("Journal entry updatedBy is required.");

        if (entry.status === "posted" && (!entry.postedAt || !entry.postedBy)) {
            errors.push("Posted Journal entry requires posting audit metadata.");
        }

        if (
            entry.status === "reversed"
            && (
                !entry.reversedAt
                || !entry.reversedBy
                || !entry.reversedByEntryId
                || !entry.reversalReason
            )
        ) {
            errors.push("Reversed Journal entry requires reversal audit metadata.");
        }

        return errors;

    }

}

export function journalEntryTotals(entry: Pick<JournalEntry, "lines">): {
    debit: number;
    credit: number;
} {

    return entry.lines.reduce(
        (totals, line) => ({
            debit: totals.debit + line.debit,
            credit: totals.credit + line.credit
        }),
        { debit: 0, credit: 0 }
    );

}

function validateLine(line: JournalLine, currency: string): string[] {

    const errors: string[] = [];

    if (!line.id.trim()) errors.push("Journal line id is required.");
    if (!line.ledgerAccountId.trim()) errors.push("Journal line Ledger account is required.");
    if (!line.accountSnapshot.code.trim()) errors.push("Journal line account code snapshot is required.");
    if (!line.accountSnapshot.displayName.trim()) errors.push("Journal line account name snapshot is required.");
    if (line.accountSnapshot.currency !== currency) errors.push("Journal line currency must match the entry currency.");
    if (!Number.isFinite(line.debit) || line.debit < 0) errors.push("Journal line debit must be non-negative.");
    if (!Number.isFinite(line.credit) || line.credit < 0) errors.push("Journal line credit must be non-negative.");

    const hasDebit = line.debit > 0;
    const hasCredit = line.credit > 0;

    if (hasDebit === hasCredit) {
        errors.push("Journal line must contain either a positive debit or a positive credit.");
    }

    return errors;

}

function isValidDate(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value)
        && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

function amountsEqual(left: number, right: number): boolean {
    return Math.abs(left - right) <= 1e-9;
}
