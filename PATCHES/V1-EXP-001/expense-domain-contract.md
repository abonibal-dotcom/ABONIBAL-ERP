# V1-EXP-001 Expense Domain Contract Proposal

## Status

This document is an implementation-ready proposal for Architect / Owner review. It is not an approved runtime contract until the decisions in `decision-record.md` are accepted.

## 1. Purpose

The Expense module records account-scoped operating expenses with stable historical descriptions and auditable lifecycle metadata. Its baseline purpose is operational recording, validation, retrieval, posting, and non-destructive voiding.

The baseline does not move cash, create Payments, update balances, create Safe movements, or create Ledger entries.

## 2. Responsibility Boundary

The Expense module owns:

- Expense identity and numbering.
- Expense date, amount, category snapshot, payee snapshot, payment-method description, reference, and notes.
- Draft, posted, and voided lifecycle state.
- Account ownership and audit metadata.
- Account-scoped persistence under `expenses:{accountId}`.

The Expense module does not own:

- Payment settlement.
- Safe or cash balances.
- Accounting journal entries.
- Customer or Supplier balances.
- Invoice allocation.
- Inventory or Product changes.
- Tax accounting.
- Attachment storage.

## 3. Proposed Expense Model

```ts
interface Expense {
    id: string;
    accountId: string;
    expenseNumber: string;
    status: ExpenseStatus;
    expenseDate: string;
    categorySnapshot: ExpenseCategorySnapshot;
    payeeType: ExpensePayeeType;
    payeeId?: string;
    payeeSnapshot: ExpensePayeeSnapshot | null;
    amount: number;
    paymentMethod: ExpensePaymentMethod;
    referenceNumber?: string;
    notes?: string;
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
    postedAt?: string;
    postedBy?: string;
    voidedAt?: string;
    voidedBy?: string;
    voidReason?: string;
}

interface ExpenseCategorySnapshot {
    displayName: string;
}

interface ExpensePayeeSnapshot {
    displayName: string;
}
```

Suggested input contracts:

```ts
interface ExpenseDraftInput {
    expenseNumber?: string;
    expenseDate: string;
    categorySnapshot: ExpenseCategorySnapshot;
    payeeType: ExpensePayeeType;
    payeeId?: string;
    payeeSnapshot?: ExpensePayeeSnapshot | null;
    amount: number;
    paymentMethod: ExpensePaymentMethod;
    referenceNumber?: string;
    notes?: string;
}

interface ExpenseDraftUpdateInput {
    expenseDate?: string;
    categorySnapshot?: ExpenseCategorySnapshot;
    payeeType?: ExpensePayeeType;
    payeeId?: string;
    payeeSnapshot?: ExpensePayeeSnapshot | null;
    amount?: number;
    paymentMethod?: ExpensePaymentMethod;
    referenceNumber?: string;
    notes?: string;
}
```

## 4. Required And Optional Fields

Required:

- `id`
- `accountId`
- `expenseNumber`
- `status`
- `expenseDate`
- `categorySnapshot.displayName`
- `payeeType`
- `amount`
- `paymentMethod`
- `createdAt`
- `createdBy`
- `updatedAt`
- `updatedBy`

Optional:

- `payeeId`
- `payeeSnapshot`
- `referenceNumber`
- `notes`
- Lifecycle-specific posted and void metadata before those states are reached.

Attachment metadata is intentionally excluded from the baseline. A later mission may add attachment references without embedding file data in localStorage.

## 5. Proposed Types

```ts
type ExpenseStatus = "draft" | "posted" | "voided";

type ExpensePayeeType =
    | "supplier"
    | "customer"
    | "employee"
    | "other";

type ExpensePaymentMethod =
    | "cash"
    | "bank_transfer"
    | "card"
    | "other";
```

`ExpensePaymentMethod` is descriptive in the baseline. It does not prove that a Payment or Safe movement occurred.

## 6. Lifecycle

```text
draft -> posted -> voided
   \----------------> voided
```

- `createDraft`: creates a draft only.
- `updateDraft`: updates a draft only.
- `post`: changes a valid draft to posted and records `postedAt` / `postedBy`.
- `void`: changes a draft or posted Expense to voided and records `voidedAt`, `voidedBy`, and `voidReason`.
- Re-posting, re-voiding, or editing posted/voided records must fail safely.
- Missing and cross-account records must fail safely.

The draft-to-voided path preserves abandoned or rejected records without hard delete. Whether the UI exposes draft voiding is an Owner decision.

## 7. Edit Policy

- Draft: editable.
- Posted: immutable as a draft.
- Voided: immutable.
- Posting and voiding update lifecycle and audit fields only.
- Correcting a posted Expense requires voiding the original and creating a new Expense; direct historical rewrite is rejected.

## 8. No Hard Delete Policy

The baseline exposes no hard-delete operation. Records remain stored for auditability. A future retention policy must not silently delete posted or voided records.

## 9. Void Policy

- A void requires a non-empty reason for posted Expenses.
- The original `id`, `accountId`, `expenseNumber`, amount, category, payee, and creation metadata remain unchanged.
- Voiding does not automatically create a Payment reversal, Safe movement, or Ledger reversal.
- When financial integrations exist, reversal orchestration must be designed and implemented in a separate integration mission.

## 10. Storage Boundary

```text
expenses:{accountId}
```

- Reads and writes require authenticated `AuthSession.account.id` matching `AuthSession.user.accountId`.
- No global `expenses` key.
- No Firebase UID/providerUserId fallback.
- No default account fallback.
- No automatic migration or deletion of legacy data.

## 11. Expense Numbering

Proposed format:

```text
EXP-YYYYMMDD-NNNN
```

- Sequence is allocated within the authenticated account's stored Expenses.
- Existing numbers are checked before append.
- Generated numbers are immutable after creation.
- This local allocator is acceptable for a single local runtime baseline but is not sync-safe. A future synchronized allocator must preserve the record contract and fail safely on collision.

## 12. Category Policy

Recommended baseline:

- Store a required stable text snapshot: `{ displayName: string }`.
- Do not require a Category module or `categoryId` in the first baseline.
- Do not silently rewrite historical Expenses when a later category name changes.
- A future category module may add optional `categoryId` while preserving the snapshot as historical truth.

Advantages:

- No dependency on an unimplemented Category module.
- Historical display survives category rename or removal.
- Minimal account-scoped baseline.

Risk:

- Free-text variants can fragment reporting. Basic reports should normalize only through explicit future category mapping, not silent mutation.

## 13. Payee Policy

- `payeeType` is required to describe the party class.
- `payeeId` is optional and must remain account-scoped if supplied.
- `payeeSnapshot` is optional and preserves display name history.
- The baseline does not load CustomerService or SupplierService.
- A future integration may select registered parties and save both id and snapshot.

## 14. Payment Method

Use the same descriptive values accepted by Payments: cash, bank transfer, card, and other.

The method field describes how the Expense is intended or reported to be paid. It must not create or imply a Payment settlement record.

## 15. Reference, Notes, And Future Attachments

- `referenceNumber`: optional external receipt, transfer, or document reference.
- `notes`: optional operational context.
- Attachments: deferred. Future support should store references and metadata, not binary data in the Expense record.

## 16. Validation Rules

- `amount` must be finite and greater than zero.
- `expenseDate` must be a valid `YYYY-MM-DD` calendar date.
- Category display name must be non-empty after trimming.
- `payeeType`, `paymentMethod`, and `status` must be accepted enum values.
- Account, identity, and required audit fields must be non-empty.
- Posted Expenses require `postedAt` and `postedBy`.
- Voided Expenses require `voidedAt`, `voidedBy`, and `voidReason`.
- Invalid input must not write or partially update storage.
- The baseline should not impose tax calculations or currency conversion.

## 17. Snapshot Policy

Snapshots are immutable historical display data after posting:

- Category snapshot remains stable.
- Payee snapshot remains stable.
- Future registered-party renames or safe deletes must not break Expense history.
- Draft snapshots may change through `updateDraft`.

## 18. Reload And Continuity

- Draft, posted, and voided records must survive reload.
- Lifecycle metadata must survive reload.
- Service reads must recompute from `expenses:{accountId}` and not depend on page memory.
- Malformed records must not crash the page; containment must follow the persistence and validator contracts.

## 19. Audit Metadata

Every Expense carries creation and update identity/timestamps. Posted and voided states carry their own actor and timestamp. Audit actors come from the authenticated application user, never Firebase UID as `accountId`.

## 20. Expense Versus Payment Boundary

- Expense records the business expense.
- Payment records settlement or movement of money.
- The baseline creates no Payment automatically.
- A future integration must prevent duplicate settlement and define linkage fields such as `expenseId`, `paymentId`, and idempotency rules.
- Expense reports must not interpret `paymentMethod` as proof of settlement.

## 21. Expense Versus Safes Boundary

- The baseline does not update Safe balances or create cash movements.
- Cash impact begins only after Safe / Cash Movement architecture is approved.
- Future Safe integration must be additive, auditable, account-scoped, and reversal-safe.

## 22. Expense Versus Basic Ledger Boundary

- The baseline creates no Ledger entry.
- Posting means the Expense record is approved and immutable, not that accounting journals exist.
- Future Ledger integration must define posting and void reversal semantics and prevent duplicate entries.

## 23. Proposed Financial Sources Of Truth

Until financial integrations are approved:

- Expense existence and lifecycle: `expenses:{accountId}`.
- Payment settlement: `payments:{accountId}` only when a future explicit linkage exists.
- Cash balance/movement: future approved Safe / Cash Movement ledger.
- Accounting/reporting ledger: future approved Basic Ledger.

Expense must not be treated as proof of cash movement. Profit, cash, payable, or balance reports must remain blocked or explicitly labelled incomplete until their source integrations are approved.

## 24. Baseline Exclusions

- Expense UI, route, and navigation.
- Expense Category module.
- Customer/Supplier integration.
- Payment creation or allocation.
- Safe or cash movement.
- Ledger posting.
- Balances and statements.
- Tax accounting and currency conversion.
- Attachments.
- Reports and profit computation.
- Import/export and sync.

## 25. Proposed Future Mission Sequence

1. `V1-EXP-002 - Expense Domain Baseline`
2. `V1-EXP-003 - Expense Page Baseline`
3. `V1-EXP-004 - Expense Runtime Validation Audit`
4. `V1-EXP-005 - Expense Module Closure Audit`
5. Separate Owner-approved Expense/Payment integration mission.
6. Separate Owner-approved Expense/Safe integration mission.
7. Separate Owner-approved Expense/Basic Ledger integration mission.

## Conservative Option Assessment

Advantages:

- Keeps Expense operationally useful without inventing cash or accounting effects.
- Avoids double counting across Expense, Payment, Safe, and Ledger records.
- Matches existing account-scoped domain and lifecycle patterns.
- Preserves historical records and snapshots.
- Allows later integrations without rewriting the baseline contract.

Risks:

- Posted Expense can be misunderstood as paid unless UI copy is explicit.
- Expense totals alone cannot represent cash balance or profit truth.
- Manual entry in both Expenses and Payments can create duplicate business intent before linkage exists.
- Text category snapshots can fragment reporting.

Mitigation:

- Keep integrations absent until separately approved.
- Use explicit UI wording in the future Page mission.
- Do not publish cash, balance, or profit calculations from Expense alone.
- Require idempotent linkage and reversal policies in future integration missions.

## Recommendation

Adopt the conservative independent Expense baseline only after explicit Owner approval of EXP-DEC-001 through EXP-DEC-010.
