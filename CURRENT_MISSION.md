# Current Mission

## Mission

`V1-SALES-009 - Sales / Invoice Lifecycle Regression Baseline`

## Classification

`ECS`

This is a full Sales / Invoice lifecycle regression verification mission.

This is not returns implementation, Product CRUD, Inventory manual adjustment,
invoice hard delete, Auth work, Route Guard weakening, or localStorage
migration.

## Objective

Verify the accepted Sales / Invoice lifecycle after V1-SALES-008.

The mission proves:

- protected invoice route;
- draft create and draft update;
- failed issue blocked by stock availability;
- successful issue creates `sale_deduction`;
- issued invoice audit view remains visible after reload;
- duplicate issue creates no duplicate deduction movement;
- issued invoice cancellation creates `sale_return`;
- duplicate cancellation creates no duplicate reversal movement;
- reload persistence preserves draft, issued, cancelled, deduction, and reversal records;
- Product records and `Product.quantity` remain unchanged;
- Inventory remains ledger-based;
- returns remain deferred.

## Accepted Baseline

- Baseline tag:
  `v1-sales-008-invoice-cancellation-stock-reversal-implementation`.
- Firebase Auth.
- Explicit `accountId`.
- Route Guard.
- Account-scoped Products.
- Product regression PASS through ECS-011.
- Inventory ledger and availability gate PASS through V1-INV-007.
- Invoice persistence baseline PASS through V1-SALES-003.
- Invoice draft create/update flow PASS through V1-SALES-004.
- Invoice issue / stock deduction flow PASS through V1-SALES-005.
- Issued invoice read / stock deduction audit view PASS through V1-SALES-006.
- Invoice cancellation / stock reversal design PASS through V1-SALES-007.
- Invoice cancellation / stock reversal implementation PASS through V1-SALES-008.

## Current Status

`V1-SALES-009 Ready for Architect / Owner Review`

## Verification Result

- Pre-check: PASS.
- Document read: PASS.
- Source inspection: PASS.
- Baseline runtime before fix: PASS.
- Source fix needed: NO.
- TypeScript: PASS.
- Build: PASS.
- Full lifecycle runtime verification: PASS.
- Console errors: 0.
- Page exceptions: 0.

## Runtime Summary

- Availability moved from 3 to 1 after issue and back to 3 after cancellation.
- Invoice count changed from 2 to 4 through expected lifecycle writes only.
- Stock movement count changed from 2 to 4 through one `sale_deduction` and one `sale_return` only.
- Product scoped storage hash remained unchanged.
- Legacy `localStorage.products` remained absent/unchanged.

## Scope Confirmation

- No returns implementation.
- No partial returns.
- No invoice hard delete.
- No Product CRUD behavior changed.
- No Product records mutated.
- `Product.quantity` not updated.
- Inventory manual adjustment behavior not changed.
- Auth behavior not changed.
- Route Guard not weakened.
- No localStorage migration.
- No Firebase UID or provider user id as `accountId`.
- No default account fallback.
- No credentials committed.
- `.env` remains untracked.

## Evidence

```text
PATCHES/V1-SALES-009/verification.md
PATCHES/V1-SALES-009/closure-report.md
outputs/V1-SALES-009/baseline-runtime.json
outputs/V1-SALES-009/baseline-dom.json
outputs/V1-SALES-009/baseline-console.log
outputs/V1-SALES-009/baseline-storage-snapshot-sanitized.json
outputs/V1-SALES-009/baseline-screenshot.png
outputs/V1-SALES-009/after-runtime.json
outputs/V1-SALES-009/after-dom.json
outputs/V1-SALES-009/after-console.log
outputs/V1-SALES-009/after-storage-snapshot-sanitized.json
outputs/V1-SALES-009/after-screenshot.png
outputs/V1-SALES-009/invoice-lifecycle-regression-summary.json
outputs/V1-SALES-009/verify-runtime.mjs
```

## Next

Recommended next step:

Architect / Owner review of V1-SALES-009.

Do not start the next mission until V1-SALES-009 is reviewed and accepted.
