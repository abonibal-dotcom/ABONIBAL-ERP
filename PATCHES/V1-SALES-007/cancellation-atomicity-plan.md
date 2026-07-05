# V1-SALES-007 - Cancellation Atomicity Plan

## Classification

INF.

This document defines the safest V1 sequence for localStorage-backed invoice
cancellation and stock reversal. It does not mutate storage.

## Constraint

localStorage is not transactional. Invoice cancellation therefore needs an
idempotent sequence that prevents silent data loss and duplicate reversal
movements.

## Recommended Sequence

1. Resolve authenticated `AuthSession`.
2. Read the invoice from `invoices:{accountId}`.
3. Require invoice status `issued`.
4. Reject already `cancelled` invoices without appending movements.
5. Validate every stock-affecting invoice line has an original
   `stockMovementId`.
6. Read movements from `stockMovements:{accountId}` only.
7. Validate each original movement:
   - exists;
   - type is `sale_deduction`;
   - quantityDelta is negative;
   - accountId matches invoice accountId;
   - productId matches invoice line productId;
   - referenceId matches invoice id.
8. Check whether a reversal already exists for each original movement.
9. Build all missing reversal movement inputs in memory.
10. Append missing `sale_return` reversal movements.
11. Re-read movement state and verify each reversal exists exactly once.
12. Mark the invoice `cancelled` with `cancelledAt`, `cancelledBy`, and
    `cancelReason`.
13. Persist optional reversal links on invoice lines if implemented.
14. Re-read the invoice and movement ledger to verify final consistency.

## Failure Behavior

If validation fails before movement append:

- do not append reversal movements;
- do not mark invoice cancelled;
- keep existing invoices and movements unchanged.

If reversal creation fails:

- do not mark invoice cancelled;
- keep existing valid invoices and movements preserved.

If reversal movements were appended but invoice update fails:

- a retry must detect the existing reversal movements and must not duplicate
  them;
- the retry may complete the invoice cancellation metadata after proving every
  original deduction already has exactly one matching reversal.

## Duplicate Safety

The cancellation command must be safe to rerun. Duplicate prevention is based
on the original `sale_deduction` movement id, not on UI state.

One original `sale_deduction` movement may have at most one cancellation
reversal movement for the same invoice cancellation.

## Data Preservation

The sequence must preserve:

- existing invoices;
- existing movement records;
- original issued invoice data;
- Product snapshots on invoice lines;
- Product records;
- legacy `localStorage.products` if present.

## Explicitly Forbidden In V1 Cancellation

- Marking invoice cancelled before reversal movements are created and verified.
- Deleting original `sale_deduction` movements.
- Voiding original `sale_deduction` movements as the normal cancellation path.
- Mutating Product records.
- Updating `Product.quantity`.
- Using a global invoice or stock movement key.
- Using Firebase UID or provider user id as `accountId`.
- Falling back to a default account.
