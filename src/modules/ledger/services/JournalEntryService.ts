import type { AuthStateService } from "../../auth/AuthStateService";
import type {
    JournalEntry,
    JournalEntryDraftInput,
    JournalEntryUpdateInput
} from "../JournalEntry";
import type { JournalLine, JournalLineInput } from "../JournalLine";
import type { LedgerAccount } from "../LedgerAccount";
import {
    isDebitNormalLedgerAccountType,
    type LedgerAccountType
} from "../LedgerAccountType";
import type { JournalSourceType } from "../JournalSourceType";
import { JournalEntryRepository } from "../repositories/JournalEntryRepository";
import {
    JournalEntryValidator,
    journalEntryTotals
} from "../validators/JournalEntryValidator";
import { LedgerAccountService } from "./LedgerAccountService";

export class JournalEntryService {

    private readonly repository: JournalEntryRepository;
    private readonly validator: JournalEntryValidator;
    private readonly authStateService: AuthStateService;
    private readonly ledgerAccountService: LedgerAccountService;

    public constructor(
        repository: JournalEntryRepository,
        validator: JournalEntryValidator,
        authStateService: AuthStateService,
        ledgerAccountService: LedgerAccountService
    ) {

        this.repository = repository;
        this.validator = validator;
        this.authStateService = authStateService;
        this.ledgerAccountService = ledgerAccountService;

    }

    public getAll(): JournalEntry[] {

        const context = this.currentAccountContext();
        return context ? this.repository.allForAccount(context.accountId) : [];

    }

    public find(entryId: string): JournalEntry | undefined {

        const context = this.currentAccountContext();
        return context
            ? this.repository.findForAccount(context.accountId, entryId.trim())
            : undefined;

    }

    public getBySource(
        sourceType: JournalSourceType,
        sourceId: string,
        sourceEvent?: string
    ): JournalEntry[] {

        const context = this.currentAccountContext();
        const normalizedSourceId = sourceId.trim();

        return context && normalizedSourceId
            ? this.repository.getBySource(
                context.accountId,
                sourceType,
                normalizedSourceId,
                normalizeOptionalText(sourceEvent)
            )
            : [];

    }

    public createDraft(input: JournalEntryDraftInput): JournalEntryMutationResult {

        const context = this.currentAccountContext();

        if (!context) return failedJournalEntryResult("Authenticated account is required.");

        const entries = this.repository.allForAccount(context.accountId);
        const idempotencyKey = normalizeOptionalText(input.idempotencyKey)
            ?? generateJournalIdempotencyKey();

        if (entries.some(entry => entry.idempotencyKey === idempotencyKey)) {
            return failedJournalEntryResult("Journal entry idempotencyKey already exists.");
        }

        const currency = normalizeCurrency(input.currency);
        const linesResult = this.resolveLines(input.lines, currency);

        if (linesResult.errors.length > 0) {
            return failedJournalEntryResult(linesResult.errors);
        }

        const now = new Date().toISOString();
        const entry: JournalEntry = {
            id: generateJournalEntryId(),
            accountId: context.accountId,
            journalNumber: generateJournalNumber(entries, now),
            status: "draft",
            entryDate: input.entryDate.trim(),
            currency,
            description: input.description.trim(),
            sourceType: input.sourceType ?? "manual",
            sourceId: normalizeOptionalText(input.sourceId),
            sourceEvent: normalizeOptionalText(input.sourceEvent),
            sourceSnapshot: input.sourceSnapshot,
            metadata: input.metadata,
            idempotencyKey,
            lines: linesResult.lines,
            createdAt: now,
            createdBy: context.userId,
            updatedAt: now,
            updatedBy: context.userId
        };
        const errors = this.validator.validate(entry);

        if (errors.length > 0) return failedJournalEntryResult(errors);

        this.repository.appendForAccount(context.accountId, entry);
        return successfulJournalEntryResult(entry);

    }

    public updateDraft(
        entryId: string,
        input: JournalEntryUpdateInput
    ): JournalEntryMutationResult {

        const context = this.currentAccountContext();

        if (!context) return failedJournalEntryResult("Authenticated account is required.");

        const current = this.repository.findForAccount(
            context.accountId,
            entryId.trim()
        );

        if (!current) return failedJournalEntryResult("Journal entry not found.");
        if (current.status !== "draft") return failedJournalEntryResult("Only draft Journal entries can be updated.");

        const currency = input.currency === undefined
            ? current.currency
            : normalizeCurrency(input.currency);
        const lineInputs = input.lines ?? current.lines.map(toJournalLineInput);
        const linesResult = this.resolveLines(lineInputs, currency);

        if (linesResult.errors.length > 0) {
            return failedJournalEntryResult(linesResult.errors);
        }

        const updatedAt = new Date().toISOString();
        const updated: JournalEntry = {
            ...current,
            accountId: context.accountId,
            entryDate: input.entryDate === undefined
                ? current.entryDate
                : input.entryDate.trim(),
            currency,
            description: input.description === undefined
                ? current.description
                : input.description.trim(),
            sourceType: input.sourceType ?? current.sourceType,
            sourceId: input.sourceId === undefined
                ? current.sourceId
                : normalizeOptionalText(input.sourceId),
            sourceEvent: input.sourceEvent === undefined
                ? current.sourceEvent
                : normalizeOptionalText(input.sourceEvent),
            sourceSnapshot: input.sourceSnapshot === undefined
                ? current.sourceSnapshot
                : input.sourceSnapshot,
            metadata: input.metadata === undefined
                ? current.metadata
                : input.metadata,
            lines: linesResult.lines,
            updatedAt,
            updatedBy: context.userId
        };
        const errors = this.validator.validate(updated);

        if (errors.length > 0) return failedJournalEntryResult(errors);

        const saved = this.repository.updateForAccount(
            context.accountId,
            current.id,
            updated
        );

        return saved
            ? successfulJournalEntryResult(saved)
            : failedJournalEntryResult("Journal entry not found.");

    }

    public post(entryId: string): JournalEntryMutationResult {

        const context = this.currentAccountContext();

        if (!context) return failedJournalEntryResult("Authenticated account is required.");

        const current = this.repository.findForAccount(
            context.accountId,
            entryId.trim()
        );

        if (!current) return failedJournalEntryResult("Journal entry not found.");
        if (current.status !== "draft") return failedJournalEntryResult("Only draft Journal entries can be posted.");

        const linesResult = this.resolveLines(
            current.lines.map(toJournalLineInput),
            current.currency
        );

        if (linesResult.errors.length > 0) {
            return failedJournalEntryResult(linesResult.errors);
        }

        const entries = this.repository.allForAccount(context.accountId);

        if (entries.some(entry =>
            entry.id !== current.id
            && entry.idempotencyKey === current.idempotencyKey
            && entry.status !== "draft"
        )) {
            return failedJournalEntryResult("Journal entry financial effect already exists.");
        }

        if (
            current.sourceType !== "manual"
            && current.sourceId
            && entries.some(entry =>
                entry.id !== current.id
                && entry.status !== "draft"
                && entry.sourceType === current.sourceType
                && entry.sourceId === current.sourceId
                && entry.sourceEvent === current.sourceEvent
            )
        ) {
            return failedJournalEntryResult("Journal source event is already posted.");
        }

        const postedAt = new Date().toISOString();
        const posted: JournalEntry = {
            ...current,
            accountId: context.accountId,
            status: "posted",
            lines: linesResult.lines,
            postedAt,
            postedBy: context.userId,
            updatedAt: postedAt,
            updatedBy: context.userId
        };
        const errors = this.validator.validate(posted);

        if (errors.length > 0) return failedJournalEntryResult(errors);

        const saved = this.repository.updateForAccount(
            context.accountId,
            current.id,
            posted
        );

        return saved
            ? successfulJournalEntryResult(saved)
            : failedJournalEntryResult("Journal entry not found.");

    }

    public reverse(entryId: string, reason: string): JournalEntryMutationResult {

        const context = this.currentAccountContext();

        if (!context) return failedJournalEntryResult("Authenticated account is required.");

        const current = this.repository.findForAccount(
            context.accountId,
            entryId.trim()
        );
        const reversalReason = reason.trim();

        if (!current) return failedJournalEntryResult("Journal entry not found.");
        if (current.status !== "posted") return failedJournalEntryResult("Only posted Journal entries can be reversed.");
        if (current.reversalOfEntryId) return failedJournalEntryResult("A reversal Journal entry cannot be reversed directly.");
        if (!reversalReason) return failedJournalEntryResult("Journal reversal reason is required.");

        const entries = this.repository.allForAccount(context.accountId);

        if (entries.some(entry => entry.reversalOfEntryId === current.id)) {
            return failedJournalEntryResult("Journal entry is already reversed.");
        }

        const reversedLineInputs = current.lines.map(line => ({
            ...toJournalLineInput(line),
            debit: line.credit,
            credit: line.debit,
            description: line.description ?? `Reversal of ${current.journalNumber}`
        }));
        const linesResult = this.resolveLines(reversedLineInputs, current.currency);

        if (linesResult.errors.length > 0) {
            return failedJournalEntryResult(linesResult.errors);
        }

        const now = new Date().toISOString();
        const reversal: JournalEntry = {
            id: generateJournalEntryId(),
            accountId: context.accountId,
            journalNumber: generateJournalNumber(entries, now),
            status: "posted",
            entryDate: todayDate(),
            currency: current.currency,
            description: `Reversal: ${current.description}`,
            sourceType: "reversal",
            sourceId: current.id,
            sourceEvent: "reversed",
            sourceSnapshot: { journalNumber: current.journalNumber },
            idempotencyKey: `journal-reversal:${current.id}`,
            lines: linesResult.lines,
            reversalOfEntryId: current.id,
            createdAt: now,
            createdBy: context.userId,
            updatedAt: now,
            updatedBy: context.userId,
            postedAt: now,
            postedBy: context.userId
        };
        const reversed: JournalEntry = {
            ...current,
            status: "reversed",
            reversedByEntryId: reversal.id,
            reversedAt: now,
            reversedBy: context.userId,
            reversalReason,
            updatedAt: now,
            updatedBy: context.userId
        };
        const errors = [
            ...this.validator.validate(reversal),
            ...this.validator.validate(reversed)
        ];

        if (errors.length > 0) return failedJournalEntryResult(errors);

        const nextEntries = entries.map(entry =>
            entry.id === reversed.id ? reversed : entry
        );
        nextEntries.push(reversal);
        this.repository.saveAllForAccount(context.accountId, nextEntries);

        return successfulJournalEntryResult(reversed, reversal);

    }

    public calculateAccountBalance(ledgerAccountId: string): number {

        return this.calculateBalanceFromEntries(
            ledgerAccountId.trim(),
            this.getAll()
        );

    }

    public calculateAccountBalanceAtDate(
        ledgerAccountId: string,
        date: string
    ): number {

        const normalizedDate = date.trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) return 0;

        return this.calculateBalanceFromEntries(
            ledgerAccountId.trim(),
            this.getAll().filter(entry => entry.entryDate <= normalizedDate)
        );

    }

    public hasPostedUsage(ledgerAccountId: string): boolean {

        const normalizedId = ledgerAccountId.trim();
        return this.getAll().some(entry =>
            entry.status !== "draft"
            && entry.lines.some(line => line.ledgerAccountId === normalizedId)
        );

    }

    public getTotals(entryId: string): { debit: number; credit: number } | null {

        const entry = this.find(entryId);
        return entry ? journalEntryTotals(entry) : null;

    }

    private resolveLines(
        inputs: JournalLineInput[],
        currency: string
    ): JournalLineResolutionResult {

        const lines: JournalLine[] = [];
        const errors: string[] = [];

        for (const input of inputs) {
            const account = this.ledgerAccountService.find(
                input.ledgerAccountId.trim()
            );

            if (!account) {
                errors.push("Journal line Ledger account was not found.");
                continue;
            }
            if (account.status !== "active") {
                errors.push("Journal line requires an active Ledger account.");
                continue;
            }
            if (!account.isPostingAccount) {
                errors.push("Journal line requires a posting Ledger account.");
                continue;
            }
            if (account.currency !== currency) {
                errors.push("Journal line account currency must match the entry currency.");
                continue;
            }

            lines.push({
                id: generateJournalLineId(),
                ledgerAccountId: account.id,
                accountSnapshot: snapshotLedgerAccount(account),
                debit: normalizeAmount(input.debit),
                credit: normalizeAmount(input.credit),
                description: normalizeOptionalText(input.description),
                partyType: input.partyType,
                partyId: normalizeOptionalText(input.partyId),
                partySnapshot: input.partySnapshot,
                metadata: input.metadata
            });
        }

        return { lines, errors };

    }

    private calculateBalanceFromEntries(
        ledgerAccountId: string,
        entries: JournalEntry[]
    ): number {

        if (!ledgerAccountId) return 0;

        let debit = 0;
        let credit = 0;
        let accountType: LedgerAccountType | undefined =
            this.ledgerAccountService.find(ledgerAccountId)?.type;

        for (const entry of entries) {
            if (entry.status === "draft") continue;
            for (const line of entry.lines) {
                if (line.ledgerAccountId !== ledgerAccountId) continue;
                accountType ??= line.accountSnapshot.type;
                debit += line.debit;
                credit += line.credit;
            }
        }

        if (!accountType) return 0;

        return isDebitNormalLedgerAccountType(accountType)
            ? debit - credit
            : credit - debit;

    }

    private currentAccountContext(): JournalContext | null {

        const state = this.authStateService.getState();
        if (state.status !== "authenticated") return null;
        const accountId = state.session.account.id.trim();
        const userAccountId = state.session.user.accountId.trim();
        const userId = state.session.user.id.trim();
        return accountId && accountId === userAccountId && userId
            ? { accountId, userId }
            : null;

    }

}

export interface JournalEntryMutationResult {
    success: boolean;
    errors: string[];
    entry: JournalEntry | null;
    relatedEntry: JournalEntry | null;
}

interface JournalContext {
    accountId: string;
    userId: string;
}

interface JournalLineResolutionResult {
    lines: JournalLine[];
    errors: string[];
}

function successfulJournalEntryResult(
    entry: JournalEntry,
    relatedEntry: JournalEntry | null = null
): JournalEntryMutationResult {
    return { success: true, errors: [], entry, relatedEntry };
}

function failedJournalEntryResult(
    errors: string | string[]
): JournalEntryMutationResult {
    return {
        success: false,
        errors: Array.isArray(errors) ? errors : [errors],
        entry: null,
        relatedEntry: null
    };
}

function toJournalLineInput(line: JournalLine): JournalLineInput {
    return {
        ledgerAccountId: line.ledgerAccountId,
        debit: line.debit,
        credit: line.credit,
        description: line.description,
        partyType: line.partyType,
        partyId: line.partyId,
        partySnapshot: line.partySnapshot,
        metadata: line.metadata
    };
}

function snapshotLedgerAccount(account: LedgerAccount) {
    return {
        code: account.code,
        displayName: account.displayName,
        type: account.type,
        currency: account.currency
    };
}

function generateJournalEntryId(): string {
    return typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `journal-entry-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function generateJournalLineId(): string {
    return typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `journal-line-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function generateJournalIdempotencyKey(): string {
    return `journal-command:${generateJournalEntryId()}`;
}

function generateJournalNumber(entries: JournalEntry[], timestamp: string): string {
    const prefix = `JRN-${timestamp.slice(0, 10).replaceAll("-", "")}-`;
    const numbers = new Set(entries.map(entry => entry.journalNumber));
    let sequence = entries
        .map(entry => entry.journalNumber)
        .filter(number => number.startsWith(prefix))
        .map(number => Number(number.slice(prefix.length)))
        .filter(Number.isFinite)
        .reduce((maximum, current) => Math.max(maximum, current), 0) + 1;
    let number = `${prefix}${String(sequence).padStart(4, "0")}`;
    while (numbers.has(number)) {
        sequence += 1;
        number = `${prefix}${String(sequence).padStart(4, "0")}`;
    }
    return number;
}

function normalizeAmount(value: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
function normalizeCurrency(value: string): string { return value.trim().toUpperCase(); }
function normalizeOptionalText(value: string | undefined): string | undefined {
    const normalized = value?.trim() ?? "";
    return normalized || undefined;
}
function todayDate(): string { return new Date().toISOString().slice(0, 10); }
