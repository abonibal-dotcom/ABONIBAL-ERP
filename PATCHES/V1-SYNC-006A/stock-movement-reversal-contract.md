# V1-SYNC-006A StockMovement Reversal Contract

## Status And Scope

This document is an implementation-ready recommendation. Every decision remains
subject to explicit Architect / Owner approval. V1-SYNC-006A changes no runtime
source, Firebase rules, storage, or operational data.

The contract aligns the local inventory ledger with the future create-only cloud
contract. It applies to future generic StockMovement void behavior. It does not
replace invoice cancellation, invoice returns, purchase returns, or another
domain-owned compensating workflow.

## Root Conflict

The current local contract is mutable:

- `StockMovement` contains optional `updatedAt`, `updatedBy`, `voidedAt`,
  `voidedBy`, and `voidReason` fields.
- `StockMovementRepository.voidForAccount()` replaces the original record in
  the account-scoped array with a copy containing those fields.
- `InventoryService.voidMovement()` invokes that repository mutation.
- derived inventory excludes a record when `voidedAt` is present.

The proposed V1-SYNC-006 cloud contract is immutable:

- create a movement once at
  `accounts/{accountId}/stockMovements/{movementId}`;
- deny updates;
- deny physical deletes.

The contracts cannot coexist for a newly voided record. A local void changes the
record checksum after cloud create, while cloud update is forbidden. Leaving the
cloud record unchanged causes devices to derive different quantities. Permitting
the update weakens append-only audit history. Therefore StockMovement sync must
remain blocked until the local void lifecycle is aligned.

## Recommended Immutable Contract

After creation, a new StockMovement record is immutable:

- identity, account, product, type, quantity, reference, cost, reason, actor,
  timestamps, and metadata cannot be updated;
- no physical delete is supported;
- no void metadata is added to the original;
- the original remains visible for the full audit history.

Future `voidMovement(originalMovementId, reason)` creates a separate reversal
movement. The existence of that movement is the source of the derived reversed
state. The original is not updated with `reversedByMovementId`.

A rebuildable lookup from `reversalOfMovementId` may be maintained as a local
cache index for efficient display. It is never a second source of truth and may
always be reconstructed from the ledger.

## Proposed Record Model

All new records created after V1-SYNC-006B should carry
`ledgerSemanticsVersion: 2`. Absence of this field means legacy V1 semantics.
This marker prevents ambiguity without rewriting old records.

The existing StockMovement fields remain the base payload. The following typed
fields are recommended:

| Field | Normal V2 movement | V2 reversal movement |
| --- | --- | --- |
| `id` | Required stable ID | Required deterministic reversal ID |
| `accountId` | Required logical account ID | Must equal original |
| `productId` | Required | Must equal original |
| `type` | Existing non-reversal type | Required value `reversal` |
| `quantityDelta` | Required finite non-zero effect | Exactly `-original.quantityDelta` |
| `reason` | Required | Human-readable reversal reason |
| `referenceType` | Existing value | Required value `movement_reversal` |
| `referenceId` | Domain reference when applicable | Original movement ID |
| `reversalOfMovementId` | Absent | Required original movement ID |
| `reversalReason` | Absent | Required normalized reason |
| `idempotencyKey` | Optional domain key | Required semantic reversal key |
| `ledgerSemanticsVersion` | Required value `2` | Required value `2` |
| `createdAt` / `createdBy` | Required | Required reversal actor and time |

`reversalOfMovementId`, `reversalReason`, and `idempotencyKey` must be top-level
typed fields. Metadata may repeat safe domain trace data but must not carry the
only copy of an invariant.

The recommended new enum values are:

- movement type: `reversal`;
- reference type: `movement_reversal`.

Using `correction`, `void`, or the original movement type for a reversal is
rejected because it makes a compensating effect ambiguous. `correction` remains
an independent adjustment. Existing `sale_return` and `purchase_return` remain
domain-specific movement types.

No new `movementDate` is recommended in V1-SYNC-006B. The current inventory
contract uses `createdAt` for record time. Adding a backdated effective-date
policy requires a separate owner decision.

## Reversal Creation Algorithm

The future domain operation must run in this order:

1. Resolve the authenticated logical account and require the session account IDs
   to match. Firebase UID is never an account ID.
2. Normalize and require `originalMovementId` and `reason`.
3. Load the original from the same account-scoped repository.
4. Validate eligibility, product identity, and finite non-zero effect.
5. Reject a legacy record already carrying `voidedAt`.
6. Reject a reversal record.
7. Derive the deterministic reversal ID and semantic idempotency key.
8. Inspect by deterministic ID and by `reversalOfMovementId`.
9. If an identical reversal exists, return it as an idempotent success.
10. If a divergent reversal exists, return a conflict and write nothing.
11. Append one new reversal with the exact opposite quantity.
12. Re-read and validate both records before returning success.

The original record is never written during this operation.

## Double-Reversal And Concurrency Protection

Use all three checks, with deterministic identity as the primary guard:

1. Derive a key-safe reversal record ID from the canonical account-scoped input
   `stockMovement:reverse:{originalMovementId}`. A SHA-256 digest or an approved
   deterministic UUID implementation may be used; do not concatenate unvalidated
   path characters.
2. Store the semantic idempotency key
   `stockMovement:reverse:{originalMovementId}` in the operation and record.
3. Query or index `reversalOfMovementId` to detect legacy or inconsistent state.

Both devices target the same Firebase record path. Create-if-absent allows one
winner. An exact existing payload/checksum is an idempotent MATCH. A different
payload, reason, quantity, account, or product under the same identity is a
conflict and must not overwrite the winner.

## Derived Quantity

Inventory remains a ledger-derived value. For one product:

```text
quantity = 0
for each account-scoped movement:
  if movement uses legacy semantics and movement.voidedAt is present:
    effect = 0
  else:
    effect = movement.quantityDelta
  quantity += effect
```

Examples:

- original `+10`, reversal `-10`: net `0`;
- sale deduction `-3`, domain sale return `+3`: net `0`;
- pulling the same movement twice: stable-ID deduplication keeps one record and
  the net effect is unchanged.

`Product.quantity`, mutable balance fields, and mutable V2 void flags are never
used as inventory truth.

## Eligibility Policy

| Original movement | Generic reversal policy |
| --- | --- |
| Legacy record already carrying `voidedAt` | Reject as already voided; retain legacy semantics |
| V2 `reversal` | Reject; reversal-of-reversal is unsupported in baseline |
| `opening_balance` | Permit once only through an explicit inventory administration command |
| `manual_adjustment` | Permit once through explicit inventory administration |
| `correction` | Permit once if it is not itself compensating another record |
| `sale_deduction` / `sale_return` | Reject generic reversal; Sales cancellation/return owns compensation |
| `purchase_receipt` / `purchase_return` | Reject generic reversal; future Purchase lifecycle owns compensation |
| Unknown or invalid type | Reject |

After a reversal, a new correction requires an explicit adjustment or the
appropriate domain command. The baseline does not reverse the reversal.

## Invoice, Return, And Purchase Boundaries

Current invoice cancellation and invoice return flows append `sale_return`
movements referencing the original sale deduction. They remain domain-specific
compensating movements:

- invoice cancellation may create one full compensating movement per line;
- invoice returns may be partial and may have multiple accepted return records;
- neither flow is rewritten as generic `reversal` in V1-SYNC-006B;
- the sync layer never calls cancellation, return, issue, or execution commands.

The current Purchase module changes purchase status only and creates no
StockMovement. Future purchase receipt/return integration requires its own
approved lifecycle and atomicity contract.

## Opening-Stock Boundary

Product creation and opening-stock creation are currently sequential local
operations. V1-SYNC-006B may align StockMovement void behavior but must not add
cross-record sync or a distributed transaction. The restarted V1-SYNC-006 must
re-evaluate crash consistency between Product capture and opening StockMovement
capture. If no approved atomic write-set contract exists, it must stop at the
existing `PRODUCT OPENING STOCK MULTI-RECORD ATOMICITY GAP` gate.

## UI Audit Contract

The future inventory history should:

- keep the original movement visible;
- show a derived `reversed` state when a reversal references it;
- show the reversal as its own row with the opposite effect;
- expose the original reference and reason;
- make the net effect understandable;
- provide no hard-delete action.
