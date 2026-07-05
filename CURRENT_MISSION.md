# Current Mission

## Mission

`V1-SALES-007 - Invoice Cancellation / Stock Reversal Design Plan`

## Classification

`INF`

This is a Sales / Invoice cancellation and stock reversal design mission.

This is not cancellation implementation, cancellation UI, returns, Product
work, Inventory mutation, Auth work, Route Guard weakening, or localStorage
migration.

## Objective

Design the safest V1 policy for cancelling issued invoices and reversing their
accepted `sale_deduction` stock movements.

The mission defines:

- which invoices can be cancelled;
- how cancelled invoice status is recorded;
- how stock deduction should be reversed;
- which stock movement type should represent reversal;
- how reversal movements link to original `sale_deduction` movements;
- how duplicate cancellation is prevented;
- how Product records remain unchanged;
- how invoice audit history remains preserved;
- the recommended next implementation mission.

## Accepted Baseline

- Baseline tag:
  `v1-sales-006-issued-invoice-read-stock-deduction-audit-view`.
- Firebase Auth.
- Explicit `accountId`.
- Route Guard.
- Account-scoped Products.
- Product regression PASS through ECS-011.
- Inventory availability gate PASS through V1-INV-007.
- Invoice persistence baseline PASS through V1-SALES-003.
- Invoice draft create/update flow PASS through V1-SALES-004.
- Invoice issue / stock deduction flow PASS through V1-SALES-005.
- Issued invoice read / stock deduction audit view PASS through V1-SALES-006.

## Current Status

`V1-SALES-007 Ready for Architect / Owner Review`

## Design Result

- Recommended issued-invoice cancellation as an audit-preserving flow.
- Recommended `issued -> cancelled` as the stock-affecting cancellation
  transition.
- Recommended positive `sale_return` movements with
  `referenceType: "invoice_return"` for stock reversal.
- Recommended traceability through reversal metadata linked to the original
  `sale_deduction`, invoice, and invoice line.
- Recommended an idempotent localStorage-safe sequence that appends reversals
  before marking the invoice cancelled.
- Recommended no returns work until cancellation is implemented and verified.

## Verification Completed

- Pre-check: PASS.
- Document read: PASS.
- Source inspection: PASS.
- TypeScript: PASS.
- Build: PASS.
- Read-only runtime verification: PASS.
- Console errors: 0.
- Page exceptions: 0.

## Scope Confirmation

- No source files changed.
- No invoice cancellation implemented.
- No cancellation UI added.
- No invoice return implemented.
- No reversal movement created.
- No Product CRUD behavior changed.
- No Product records mutated.
- `Product.quantity` not updated.
- Inventory behavior not changed.
- Auth behavior not changed.
- Route Guard not weakened.
- No localStorage migration.
- No Firebase UID or provider user id as `accountId`.
- No default account fallback.
- No credentials committed.
- `.env` remains untracked.

## Evidence

```text
PATCHES/V1-SALES-007/invoice-cancellation-design-plan.md
PATCHES/V1-SALES-007/stock-reversal-design-plan.md
PATCHES/V1-SALES-007/cancellation-atomicity-plan.md
PATCHES/V1-SALES-007/cancellation-ui-policy.md
PATCHES/V1-SALES-007/closure-report.md
outputs/V1-SALES-007/runtime.json
outputs/V1-SALES-007/dom.json
outputs/V1-SALES-007/console.log
outputs/V1-SALES-007/storage-snapshot-sanitized.json
outputs/V1-SALES-007/screenshot.png
outputs/V1-SALES-007/verify-runtime.mjs
```

## Next

Recommended next mission:

`V1-SALES-008 - Invoice Cancellation / Stock Reversal Implementation`

Do not start the next mission until V1-SALES-007 is reviewed and accepted.
