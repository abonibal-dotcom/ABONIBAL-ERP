# V1-CASH-001 Cash Movement Contract Proposal

## Status

Implementation-ready proposal for Architect / Owner review. This document does not authorize runtime balance calculation or movement writes.

## 1. Purpose And Source Of Truth

CashMovement is the append-oriented account-scoped record of money entering or leaving a Safe. The current balance is derived from valid posted/reversed movement history, never from a mutable Safe balance field.

## 2. Storage Boundary

```text
cashMovements:{accountId}
```

- All movements for the account share one account-scoped array/key.
- Every movement also carries explicit `accountId` and `safeId`.
- Cross-account Safe references are rejected.
- No global `cashMovements` key or account fallback.

## 3. Proposed CashMovement Model

```ts
interface CashMovement {
    id: string;
    accountId: string;
    movementNumber: string;
    safeId: string;
    safeSnapshot: {
        displayName: string;
        currencyCode: string;
    };
    type: CashMovementType;
    status: CashMovementStatus;
    amount: number;
    movementDate: string;
    reason: string;
    referenceType: CashMovementReferenceType;
    referenceId?: string;
    referenceSnapshot?: Record<string, unknown>;
    transferId?: string;
    idempotencyKey: string;
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
    postedAt?: string;
    postedBy?: string;
    reversedAt?: string;
    reversedBy?: string;
    reversalMovementId?: string;
    reversesMovementId?: string;
    reversalReason?: string;
}
```

## 4. Movement Types And Direction

```ts
type CashMovementType =
    | "opening_balance"
    | "cash_in"
    | "cash_out"
    | "transfer_in"
    | "transfer_out"
    | "adjustment_in"
    | "adjustment_out";
```

Direction is derived from type:

- Inflow: `opening_balance`, `cash_in`, `transfer_in`, `adjustment_in`.
- Outflow: `cash_out`, `transfer_out`, `adjustment_out`.

The stored amount is always positive. Negative amounts and zero are invalid.

Reversal movements use the opposite directional type, plus `referenceType: "reversal"` and `reversesMovementId`. Examples:

- Reverse `cash_in` with `cash_out`.
- Reverse `cash_out` with `cash_in`.
- Reverse `adjustment_in` with `adjustment_out`.
- Reverse opening balance with `adjustment_out`.
- Transfers are reversed as a new linked transfer pair.

## 5. Proposed Lifecycle

```text
draft -> posted -> reversed
```

- Draft: editable and does not affect balance.
- Posted: immutable and affects balance.
- Reversed: original remains immutable and continues to be included historically; a linked posted opposite movement offsets it.
- No hard delete.
- Duplicate post/reversal attempts fail safely or return the existing idempotent result.

## 6. Posted Movement Immutability

After posting, amount, Safe, type, date, reference, and reason cannot be edited. Corrections require reversal plus a new movement.

## 7. Reversal Policy

1. Validate the original posted movement and account boundary.
2. Reject an already reversed movement unless returning the existing idempotent result.
3. Validate the reversal will use the same Safe, currency, amount, and opposite direction.
4. Append the reversal movement.
5. Mark the original `reversed` with pointer and audit metadata only after append succeeds.
6. Preserve both records forever.

Balance computation includes both original reversed records and their posted reversal movements. The pair nets to zero. Excluding the original after also appending an opposite movement would incorrectly apply the reversal twice and is forbidden.

## 8. Safe-to-Safe Transfer

A transfer is one business operation represented by two movements:

- `transfer_out` from source Safe.
- `transfer_in` to destination Safe.

Both share one `transferId`, amount, currency, movement date, reference snapshot, and idempotency boundary.

Because both records live under `cashMovements:{accountId}`, the service should validate both and persist the pair in one array write. It must never append one side before the other. If validation or write fails, neither movement is accepted.

Transfer rules:

- Source and destination Safes must differ.
- Both Safes must be active and belong to the account.
- Currency codes must match.
- Source balance must remain non-negative under the recommended policy.
- Reversal creates a new opposite transfer pair with a new transferId linked to the original transferId.

## 9. Negative Balance Policy

Recommended V1 policy: prevent posting any outflow that would make the Safe balance negative.

- Check current computed balance before posting.
- Include all prior balance-affecting movements.
- Transfers and reversals use the same gate.
- No overdraft setting in the baseline.
- A future Owner-approved setting may permit negative balance for selected Safe types, but must not silently change existing behavior.

## 10. Movement Date And Creation Date

- `movementDate`: required valid `YYYY-MM-DD` business date used by balance-at-date calculations.
- `createdAt`: immutable system timestamp for audit order.
- `postedAt` and `reversedAt`: lifecycle timestamps.
- Backdated movement policy must be explicit in UI and future reporting; the baseline may allow valid dates but must preserve creation audit order.

## 11. Amount Validation

- Amount must be finite and greater than zero.
- Direction comes from movement type, not the amount sign.
- Currency must match the referenced Safe.
- No currency conversion or floating exchange-rate behavior.

## 12. Reference Contract

Recommended reference types:

```ts
type CashMovementReferenceType =
    | "manual"
    | "opening_balance"
    | "payment"
    | "expense"
    | "sale"
    | "purchase"
    | "transfer"
    | "adjustment"
    | "reversal"
    | "other";
```

`referenceId` points to the source record when an integration exists. `referenceSnapshot` preserves display-safe historical context. Baseline manual movements must not fabricate links to Payments, Expenses, Sales, or Purchases.

## 13. Idempotency

- Every movement command carries an immutable `idempotencyKey` unique within the account.
- Transfer pair commands share one business idempotency key plus distinct movement ids.
- Repeated commands with the same key and equivalent payload return the existing movement/result.
- Same key with different payload fails safely.
- Integration missions must derive stable keys from source record and lifecycle event, such as `payment:{id}:posted`.

## 14. Audit Metadata

Creation, update, posting, and reversal actors/timestamps come from the authenticated application user. `accountId` is explicit and never derived from Firebase UID/providerUserId.

## 15. Reload And Continuity

- Draft, posted, reversed, transfer-pair, and reversal links survive reload.
- Balance is recomputed from storage after reload.
- Missing Safe references render safely from Safe snapshot but reject new lifecycle actions.
- Malformed records are excluded or surfaced according to repository/validator policy without crashing valid balance computation.

## 16. Current Balance Calculation

For one Safe:

```text
balance = sum(signed amount of every balance-affecting movement)
```

- Draft movements: excluded.
- Posted movements: included.
- Reversed originals: included because their posted reversal movement offsets them.
- Reversal movements: included according to their direction.
- Other Safes: excluded.
- Other accounts: excluded.

No cached balance is authoritative.

## 17. Balance At Date

Use the same formula, including movements where `movementDate <= requestedDate`. Creation time does not replace business movement date. Reversed originals and their reversal movements are included according to each movement's own date, so historical balances remain time-aware.

## 18. Reconciliation

Deferred. Future reconciliation should compare computed book balance with counted/statement balance and create explicit adjustment movements after approval. It must never overwrite Safe balance.

## 19. Integration Boundaries

- Payments: no automatic movement in baseline.
- Expenses: no automatic movement in baseline.
- Sales/Purchases: no direct movement in baseline.
- Basic Ledger: no entry creation in baseline.
- Every integration must be separate, idempotent, account-scoped, and reversal-safe.

## 20. Baseline Exclusions

- Runtime entities, repositories, services, pages, routes, and balance calculations.
- Transfers and reversal implementation.
- Payment/Expense/Sales/Purchase integration.
- Ledger integration.
- Reconciliation.
- Multi-currency conversion.
- Reports, statements, import/export, and sync.

## Conservative Design Assessment

Advantages:

- Prevents mutable balance corruption.
- Preserves an auditable append-oriented history.
- Supports multiple Safes without mixing account data.
- Makes reversal, transfer, and integration effects traceable.
- Avoids double counting across Payments, Expenses, Sales, Purchases, and Ledger.

Risks:

- Reversal pairs and transfer pairs require careful idempotency.
- LocalStorage has no cross-key transaction support.
- Backdated movements can change historical balance views.
- Negative-balance prevention depends on reliable sequential posting.
- Text snapshots may drift from current Safe names by design.

Mitigation:

- Keep transfer pair writes in one account-scoped movement-array write.
- Validate complete commands before mutation.
- Require immutable ids, transfer ids, and idempotency keys.
- Separate every external module integration into an approved mission.
