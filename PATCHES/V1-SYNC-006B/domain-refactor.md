# V1-SYNC-006B Domain Refactor

## Scope

V1-SYNC-006B aligns the local StockMovement domain with the owner-approved
immutable reversal contract. It adds no Firebase StockMovement integration,
migration, listener, operational write, backfill, or deployment.

## Previous Mutable Behavior

The previous void path was:

```text
InventoryService.voidMovement()
  -> StockMovementRepository.voidForAccount()
  -> replace the original stored record
  -> add voidedAt / voidedBy / voidReason / updatedAt / updatedBy
```

Derived quantity then omitted every movement carrying `voidedAt`. That behavior
remains supported only when reading legacy records.

## Immutable V2 Record Contract

Every StockMovement created through `InventoryService.addMovement()` now carries:

```text
ledgerSemanticsVersion: 2
```

The repository no longer extends the generic repository with `clear()`, exposes
no update or delete API, and no longer contains `voidForAccount()`. Its append
operation has create-once semantics:

- absent stable ID: append;
- identical stable ID and canonical payload: return the existing record;
- same stable ID with different payload: immutable identity conflict;
- account mismatch: reject.

Canonical equality sorts object keys recursively and ignores `undefined`
properties. It does not import or invoke the Firebase sync layer.

## Reversal Model

The new typed model adds:

- movement type `reversal`;
- reference type `movement_reversal`;
- `ledgerSemanticsVersion`;
- `reversalOfMovementId`;
- `reversalReason`;
- `idempotencyKey`.

A valid reversal has:

- a new stable ID;
- the same logical account and product as the original;
- `quantityDelta` equal to `-original.quantityDelta`;
- `referenceId` and `reversalOfMovementId` equal to the original ID;
- required reason, actor, and timestamp;
- immutable semantics version `2`.

`StockMovementValidator` rejects malformed reversal records, V2 records carrying
legacy void metadata, non-reversal records carrying reversal fields, invalid
deterministic identity, and direct zero-effect reversals.

## Deterministic Identity

Current StockMovement IDs are UUIDs and therefore satisfy the accepted key-safe
character set. The domain derives:

```text
movement ID: reversal-{originalMovementId}
idempotency key: stockMovement:reverse:{originalMovementId}
```

An original ID outside `[A-Za-z0-9_-]` is rejected rather than encoded or
silently changed. This preserves exact, deterministic identity for current IDs
and stops unsafe legacy IDs for explicit review.

## Service Behavior

`InventoryService.reverseMovement(originalId, reason)` now:

1. resolves the authenticated logical account;
2. validates ID and reason;
3. loads the original from the same account scope;
4. rejects a missing original, reversal, legacy-voided record, zero effect, or
   a domain-owned/unsupported type;
5. derives deterministic identity;
6. checks all existing reversals for the original;
7. returns one exact existing reversal idempotently;
8. rejects divergent or duplicate reversal data;
9. validates and appends one exact opposite record;
10. never writes the original.

`voidMovement()` remains as a compatibility-facing API and delegates directly
to `reverseMovement()`. New code cannot reach a mutable void repository method.

Direct use of `addMovement({ type: "reversal" })` is rejected. Reversals can be
created only through the validated domain operation.

## Eligibility

Generic reversal is allowed once for:

- `opening_balance`;
- `manual_adjustment`;
- `correction`.

It is rejected for:

- `reversal`;
- legacy records carrying `voidedAt`;
- `sale_deduction` and `sale_return`;
- `purchase_receipt` and `purchase_return`;
- legacy/ambiguous `void` records;
- invalid or zero-effect records.

Sales cancellation and invoice return continue to own their accepted
`sale_return` lifecycle. Purchase remains status-only and creates no inventory
movement in the current baseline.

## Derived Quantity

The reducer now applies dual compatibility semantics:

```text
legacy record with voidedAt: 0
legacy normal record: quantityDelta
V2 normal record: quantityDelta
V2 reversal record: quantityDelta
```

Therefore an original `+10` and reversal `-10` produce `0`; an original `-3`
and reversal `+3` produce `0`. `Product.quantity` remains legacy descriptive
data and is never inventory truth.

## Inventory History UI

The inventory page keeps the original and reversal as separate rows. It derives
and exposes:

- legacy void state: `data-voided` and `data-legacy-voided`;
- reversal identity: `data-reversal` and `data-reversal-of`;
- original reversed state: `data-reversed`;
- Arabic labels for legacy voided, reversal, reversed, and active states;
- original movement reference in the reversal reason display.

The old `data-voided` attribute remains for audit-selector compatibility. No
hard-delete action was added.

## Explicitly Unchanged Boundaries

- no Invoice or InvoiceReturn repository change;
- no Purchase, Payment, Expense, Cash, or Ledger repository change;
- no Container change;
- no Firebase rules/config/runtime change;
- no localStorage migration or rewrite;
- no StockMovement sync, scan, listener, upload, or backfill;
- default SyncMode remains `disabled`;
- production remains untouched.
