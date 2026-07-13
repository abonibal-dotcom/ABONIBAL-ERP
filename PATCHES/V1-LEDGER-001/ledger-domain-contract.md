# V1-LEDGER-001 Basic Ledger Domain Contract

## Status And Authority Conflict

OWNER APPROVAL REQUIRED

The repository currently contains two binding decisions:

- V1 includes a basic auditable ledger.
- Full double-entry accounting is deferred unless later approved.

This document recommends a minimal double-entry journal as the safest ledger invariant, but does not override the existing deferral. Explicit Owner approval must clarify that a balanced double-entry journal engine is permitted while full accounting-suite features remain deferred.

## 1. Purpose

The Basic Ledger records account-scoped accounting events as immutable, balanced journal entries. It provides audit traceability, account debit/credit history, current balances, and balances at a business date.

It does not replace operational modules. Invoices remain the Sales source, Expenses remain the expense-record source, Payments remain settlement records, Cash Movements remain the cash-balance source, Purchases remain purchase records, and Stock Movements remain the quantity source.

## 2. Responsibility Boundary

The Ledger owns:

- Journal identity, numbering, lifecycle, and audit metadata.
- Balanced debit and credit lines.
- Ledger account references and immutable account snapshots.
- Source traceability and idempotency.
- Reversal entries.
- Derived debit, credit, and net account balances.
- Account-scoped persistence under `ledgerEntries:{accountId}`.

The Ledger does not own:

- Invoice, Purchase, Expense, Payment, Safe, or Inventory lifecycle.
- Cash balance, stock quantity, settlement allocation, or party balances by itself.
- Product costing, tax calculation, currency conversion, reconciliation, financial statements, closing periods, or profit computation in the baseline.

## 3. Double-entry Versus Single-entry

Recommended conservative option: a minimal double-entry auditable journal.

Every posted JournalEntry contains at least two lines and satisfies:

```text
totalDebit = totalCredit
```

Why this is preferred:

- It makes omissions and one-sided effects detectable.
- It supports future receivable, payable, cash, inventory, revenue, and expense balances without rewriting the storage contract.
- It gives reversal a precise, testable meaning.
- It prevents a future migration from an ambiguous single-entry event list.

This recommendation does not include a full accounting suite. Period closing, taxation, depreciation, consolidation, budgeting, bank reconciliation, and statutory reporting remain deferred.

## 4. Proposed JournalEntry Model

```ts
interface JournalEntry {
    id: string;
    accountId: string;
    journalNumber: string;
    status: "draft" | "posted" | "reversed";
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
```

Recommended source types:

```ts
type JournalSourceType =
    | "manual"
    | "payment"
    | "expense"
    | "cash_movement"
    | "sales_invoice"
    | "invoice_return"
    | "purchase"
    | "inventory"
    | "opening_balance"
    | "reversal"
    | "other";
```

`sourceEvent` distinguishes lifecycle events such as `posted`, `issued`, `cancelled`, `returned`, or `reversed`. It is recommended for integrated entries because one source record may produce more than one valid lifecycle event.

## 5. Proposed JournalLine Model

```ts
interface JournalLine {
    id: string;
    ledgerAccountId: string;
    accountSnapshot: {
        code: string;
        displayName: string;
        type: LedgerAccountType;
        currency: string;
    };
    debit: number;
    credit: number;
    description?: string;
    partyType?: "customer" | "supplier" | "other";
    partyId?: string;
    partySnapshot?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}
```

Line rules:

- Exactly one of `debit` or `credit` must be greater than zero.
- The other side must be zero.
- Negative and non-finite amounts are invalid.
- Every account must belong to the same authenticated account, be active, and be a posting account.
- Every line currency must match the entry currency.
- Account snapshots preserve historical display after account rename or inactivation.
- Lines are embedded in the JournalEntry so one entry and all its lines can be validated and stored with one array write.

## 6. Storage Boundaries

```text
ledgerEntries:{accountId}
ledgerAccounts:{accountId}
```

- Both keys require explicit `AuthSession.account.id` matching the authenticated user account boundary.
- No global Ledger keys.
- No Firebase UID/providerUserId or default-account fallback.
- Journal entries and accounts from another account are never visible or accepted.
- Embedded lines prevent a partially stored entry header without its debit/credit lines.

## 7. Lifecycle

```text
draft -> posted -> reversed
```

- Draft is editable and has no balance effect.
- Posted is immutable and affects account balances.
- Reversed preserves the original and links it to a new posted reversal entry.
- No hard delete exists for posted or reversed entries.
- Draft-delete policy is deferred; conservative baseline keeps drafts and allows non-destructive void/abandonment only if separately approved.

## 8. Posting Validation

Posting requires:

1. Authenticated account context.
2. At least two valid lines.
3. Active posting accounts in the same account boundary.
4. One explicit entry currency.
5. Finite positive line amounts.
6. Equal debit and credit totals at an approved precision.
7. A non-empty idempotency key.
8. No conflicting posted entry for the same source event or idempotency key.
9. Complete audit metadata.

Rounding precision and tolerance are accounting decisions and must be Owner-approved before implementation. Silent balancing lines are forbidden.

## 9. Posted Immutability

After posting, the entry date, currency, source, description, lines, accounts, debit, credit, and snapshots cannot change. Corrections use reversal plus a new entry. Editing posted financial history would invalidate downstream balances and audit evidence.

## 10. Reversal Policy

Reversal creates one new posted entry where every original debit becomes a credit and every original credit becomes a debit.

- The original remains stored and changes only to `reversed` with audit pointers.
- The reversal has `reversalOfEntryId` and `sourceType: "reversal"`.
- The original has `reversedByEntryId`.
- Reversal is idempotent and requires a reason.
- Duplicate or partial reversal is rejected.
- The original reversed entry remains included in balance history; the posted opposite entry offsets it. Excluding the original as well would reverse the effect twice.

## 11. Numbering And Dates

Recommended local format:

```text
JRN-YYYYMMDD-NNNN
```

- `journalNumber` is unique within the account and immutable after creation.
- `entryDate` is the business date used for balance-at-date reporting.
- `createdAt` is the immutable system audit timestamp.
- Backdated posting may alter historical balances and therefore needs explicit future period policy.
- The local sequence is not synchronization-safe; future sync must add collision handling without changing historical numbers silently.

## 12. Currency Policy

- One explicit uppercase currency per JournalEntry.
- Every line and referenced LedgerAccount must use that currency.
- No currency conversion or exchange-rate lines in the baseline.
- Recommended V1 default is one Owner-approved account/workspace base currency.
- Entries in another currency remain blocked until a multi-currency contract defines transaction currency, base currency, rate source, and gain/loss handling.

## 13. Source Traceability

- `sourceType` identifies the operational domain.
- `sourceId` identifies the source record.
- `sourceEvent` identifies the lifecycle event.
- `sourceSnapshot` preserves minimal historical display context.
- `metadata` may preserve integration-specific ids but must not replace typed identity fields.
- Manual entries use `sourceType: "manual"` and must not fabricate links to operational records.

## 14. Idempotency And Duplicate Prevention

- Every posting command has an immutable account-scoped `idempotencyKey`.
- Recommended integrated format: `{sourceType}:{sourceId}:{sourceEvent}`.
- Equivalent replay returns the existing result without another financial effect.
- The same key with different currency, totals, accounts, or source fails safely.
- Source uniqueness and idempotency are both checked; neither alone is sufficient.
- Reversal uses a stable key derived from the original entry, such as `ledger-reversal:{entryId}`.

## 15. Audit Metadata

Creation, update, posting, and reversal actors come from the authenticated application user. `accountId` never comes from Firebase UID. Entry and line identifiers, source identity, numbers, posted timestamps, and original snapshots remain stable.

## 16. Account Balance Calculation

Balance is derived from all balance-affecting entries and never stored as an authoritative mutable field.

For asset and expense accounts:

```text
balance = totalDebit - totalCredit
```

For liability, equity, and revenue accounts:

```text
balance = totalCredit - totalDebit
```

Reports should retain raw debit and credit totals in addition to net balance. Draft entries are excluded. Posted entries, reversed originals, and posted reversal entries are included according to their lines.

## 17. Balance At Date

Use the same calculation with entries where `entryDate <= requestedDate`. Creation time does not replace the business date. Reversal affects history from the reversal entry's own date, preserving time-aware audit behavior.

## 18. Reload And Continuity

- Draft, posted, reversed, source links, idempotency keys, lines, and snapshots survive reload.
- Balances are recomputed from `ledgerEntries:{accountId}`.
- Missing or inactive current account records display from line snapshots but reject new posting actions.
- Malformed records must not crash valid journal reads; containment must follow repository and validator contracts without silently rewriting stored history.

## 19. Conservative Design Assessment

Advantages:

- Enforces balanced accounting effects.
- Preserves immutable audit history and deterministic reversal.
- Supports future reports without treating operational records as journals.
- Makes duplicate and one-sided posting observable.

Risks and complexity:

- Account mapping is a financial policy, not a technical default.
- Cross-key localStorage integration is not transactional.
- Backdating and rounding can alter historical reports.
- Inventory valuation and COGS require a cost method not present in the quantity ledger.
- The recommendation needs explicit approval because current governance defers full double-entry accounting.

Impact on the current system:

- No current module changes are required for the Ledger baseline.
- Future integrations need source-event linkage, idempotency, failure visibility, and reversal orchestration.
- Existing operational ledgers remain authoritative for their domains.

## 20. Baseline Exclusions

- Automatic posting from any module.
- UI, route, navigation, reports, trial balance, profit/loss, balance sheet, or closing periods.
- Tax, depreciation, accrual schedules, allocations, cost centers, budgets, bank reconciliation, and consolidation.
- Inventory valuation and COGS automation.
- Multi-currency conversion and exchange gains/losses.
- Sync, import/export, permissions, and advanced accounting.

## Recommendation

Approve a minimal account-scoped double-entry journal engine only if the Owner explicitly authorizes the double-entry invariant as the Basic Ledger foundation while retaining all advanced accounting features as deferred.
