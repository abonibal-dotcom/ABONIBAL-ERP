# Current Mission

## Mission

`V1-SALES-014 - Sales Lifecycle Regression Including Returns`

## Classification

`ECS`

This is a full Sales lifecycle regression mission including invoice returns.

This is not new feature implementation, Product CRUD, Inventory manual
adjustment work, invoice hard delete, Auth work, Route Guard weakening, or
localStorage migration.

## Objective

Verify and stabilize the complete accepted Sales lifecycle including returns:

- protected invoice route;
- draft create and update;
- invoice issue and `sale_deduction`;
- issued audit view;
- issued invoice cancellation and cancellation `sale_return`;
- invoice return persistence;
- invoice return execution;
- invoice return UI;
- partial return;
- over-return rejection;
- duplicate return safety;
- reload persistence;
- Product safety;
- Inventory ledger correctness.

## Accepted Baseline

- Baseline tag: `v1-sales-013-invoice-returns-ui-flow`.
- Firebase Auth.
- Explicit `accountId`.
- Route Guard.
- Account-scoped Products.
- Product regression PASS through ECS-011.
- Inventory ledger and availability gate PASS through V1-INV-007.
- Sales / Invoice lifecycle PASS through V1-SALES-009.
- Return persistence PASS through V1-SALES-011.
- Return execution PASS through V1-SALES-012.
- Return UI PASS through V1-SALES-013.

## Current Status

`V1-SALES-014 Ready for Architect / Owner Review`

## Implementation Result

No source fix was needed. V1-SALES-014 added regression evidence and
documentation only.

## Verification Result

- TypeScript: PASS.
- Build: PASS.
- Runtime: PASS.
- Console errors: 0.
- Page exceptions: 0.
- Runtime evidence saved under `outputs/V1-SALES-014/`.

## Scope Confirmation

- No source files changed.
- No Product CRUD behavior change.
- No Product record mutation.
- `Product.quantity` unchanged.
- No invoice hard delete.
- No invoice deletion.
- No return deletion.
- No stock movement deletion.
- No Auth behavior change.
- Route Guard remains active.
- No localStorage migration.
- No Firebase UID or provider user id used as `accountId`.
- No default account fallback.
- `.env` remains untracked.

## Evidence / Documents

```text
outputs/V1-SALES-014/baseline-runtime.json
outputs/V1-SALES-014/baseline-dom.json
outputs/V1-SALES-014/baseline-console.log
outputs/V1-SALES-014/baseline-storage-snapshot-sanitized.json
outputs/V1-SALES-014/baseline-screenshot.png
outputs/V1-SALES-014/after-runtime.json
outputs/V1-SALES-014/after-dom.json
outputs/V1-SALES-014/after-console.log
outputs/V1-SALES-014/after-storage-snapshot-sanitized.json
outputs/V1-SALES-014/after-screenshot.png
outputs/V1-SALES-014/sales-lifecycle-returns-regression-summary.json
PATCHES/V1-SALES-014/verification.md
PATCHES/V1-SALES-014/closure-report.md
```

## Next

Recommended next step:

Architect / Owner review of V1-SALES-014.

Do not start the next mission until V1-SALES-014 is reviewed and accepted.
