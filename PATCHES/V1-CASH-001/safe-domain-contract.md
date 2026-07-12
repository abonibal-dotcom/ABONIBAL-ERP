# V1-CASH-001 Safe Domain Contract Proposal

## Status

Implementation-ready proposal for Architect / Owner review. No runtime contract is approved until the decisions in `decision-record.md` are accepted.

## 1. Purpose

The Safe module identifies account-scoped cash locations such as a physical cash drawer, bank-designated cash account, or other operational money container. A Safe provides identity, currency, lifecycle, and audit metadata for Cash Movements.

A Safe does not store an authoritative mutable balance.

## 2. Responsibility Boundary

The Safe module owns:

- Safe identity and account ownership.
- Display name and optional description.
- Fixed currency code.
- Active/inactive lifecycle.
- Optional default-safe designation for UI selection.
- Audit metadata.
- Account-scoped persistence under `safes:{accountId}`.

The Safe module does not own:

- Mutable balance.
- Opening balance amount.
- Cash movement posting.
- Payment, Expense, Sales, or Purchase integration.
- Currency conversion.
- Basic Ledger entries.
- Reconciliation.

## 3. Proposed Safe Model

```ts
interface Safe {
    id: string;
    accountId: string;
    safeNumber: string;
    displayName: string;
    currencyCode: string;
    status: SafeStatus;
    isDefault: boolean;
    notes?: string;
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
    inactivatedAt?: string;
    inactivatedBy?: string;
    inactiveReason?: string;
}

type SafeStatus = "active" | "inactive";
```

`archived` is not recommended for the baseline. `inactive` already prevents new operational use while preserving history. A later retention policy may introduce archive semantics without deleting records.

## 4. Required And Optional Fields

Required:

- `id`
- `accountId`
- `safeNumber`
- `displayName`
- `currencyCode`
- `status`
- `isDefault`
- Creation/update audit metadata

Optional:

- `notes`
- Inactivation actor, timestamp, and reason before inactivation

## 5. Storage Boundary

```text
safes:{accountId}
```

- Reads and writes require authenticated `AuthSession.account.id` matching the user account boundary.
- No global `safes` key.
- No Firebase UID/providerUserId fallback.
- No default account fallback.
- Safe records from another account are never visible or accepted.

## 6. Multiple Safe Policy

Recommended baseline:

- An account may own multiple Safes.
- Safe names need not be globally unique, but normalized display name should be unique within the account to reduce operator mistakes.
- `safeNumber` must be unique within the account and immutable after creation.
- Every Cash Movement must reference one explicit `safeId`.
- The service must never silently substitute the default Safe when `safeId` is absent.

## 7. Default Safe Policy

- At most one active Safe may have `isDefault: true` per account.
- The default is a UI convenience, not an authorization or fallback boundary.
- Creating or selecting a new default must demote the prior default in one validated account-scoped update.
- The default Safe cannot be inactivated until another active Safe is selected as default, unless no active Safe remains by explicit Owner-approved workflow.
- Runtime commands still require an explicit `safeId`.

## 8. Currency Policy

- Each Safe has one immutable ISO 4217-style uppercase currency code.
- The baseline performs no currency conversion.
- Transfers require source and destination Safes to use the same currency.
- A currency change after movements exist is forbidden.
- A future Settings mission may supply the default currency for new Safe forms, but the Safe record remains explicit.

## 9. Opening Balance Policy

Opening balance is not a Safe field. It is a separate posted Cash Movement with:

```text
type: opening_balance
safeId: explicit Safe id
amount: positive amount
```

Only one active opening-balance movement per Safe is recommended. Corrections use reversal plus a new opening-balance or adjustment movement according to the approved Cash Movement policy.

## 10. Balance Mutation Policy

- No `Safe.balance` field is authoritative.
- Safe create/update never receives a balance.
- Balance is computed from the Cash Movement ledger.
- Direct balance overwrite, increment, decrement, and reconciliation mutation are forbidden.
- Optional future cached balances must be rebuildable and never authoritative.

## 11. Hard Delete Policy

- The baseline exposes no hard delete.
- A Safe with movements must never be deleted.
- A Safe without movements should still be inactivated rather than deleted in the baseline.
- Historical Cash Movements retain `safeId` and a Safe snapshot so display remains stable after inactivation.

## 12. Inactivation Policy

- Active Safe: may receive new valid movements.
- Inactive Safe: read-only for history and balance; no new movement or transfer posting.
- Inactivation requires a reason and audit metadata.
- Existing movements and computed balance remain visible.
- Inactivation with non-zero balance should be rejected until balance is transferred or adjusted to zero through approved movements.

## 13. Audit Metadata

Create and update actor/timestamps are required. Inactivation records actor, timestamp, and reason. Actors come from the authenticated application user; Firebase UID is never used as `accountId`.

## 14. Safe And Cash Movement Relationship

- Every movement references one explicit Safe.
- Movement accountId must match Safe accountId.
- Movement stores an immutable Safe snapshot containing at least display name and currency code.
- Inactive or missing Safe rejects new movement posting.
- Safe lifecycle never edits historical Cash Movements.

## 15. Safe And Payments

No automatic Payment integration in the baseline. A future integration must explicitly select a Safe and create one idempotent Cash Movement only when the Payment lifecycle policy says cash impact occurs.

## 16. Safe And Expenses

No automatic Expense integration in the baseline. Expense payment method is descriptive only. A future integration must prevent duplicate Payment/Expense/Safe effects.

## 17. Safe And Sales / Purchases

Invoices and Purchases do not directly mutate a Safe in the baseline. Cash impact must flow through a separately approved Payment/Cash integration contract.

## 18. Safe And Basic Ledger

The Safe baseline creates no Basic Ledger entries. Future Ledger integration may reference Cash Movements, but must not replace the Cash Movement ledger as the cash-balance source of truth.

## 19. Baseline Exclusions

- Cash Movement implementation.
- Balance calculation UI.
- Transfers.
- Payment/Expense/Sales/Purchase integration.
- Basic Ledger integration.
- Reconciliation.
- Multi-currency conversion.
- Import/export and sync.
- Reports and statements.

## Recommendation

Approve a multiple-Safe, single-currency-per-Safe model with active/inactive lifecycle, one optional default for UI convenience, no hard delete, and no mutable balance.
