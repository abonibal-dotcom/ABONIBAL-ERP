# Current Mission

## Mission

`V1-SALES-010 - Invoice Returns / Partial Returns Design Plan`

## Classification

`INF`

This is a Sales returns design mission.

This is not returns implementation, partial returns implementation, return UI,
Product CRUD, Inventory manual adjustment work, Auth work, Route Guard
weakening, or localStorage migration.

## Objective

Design the safe V1 policy for invoice returns and partial returns after the
accepted Sales / Invoice lifecycle regression baseline.

The mission defines:

- V1 return scope;
- return record model;
- return line model;
- account-scoped return storage boundary;
- Inventory ledger integration policy;
- invoice lifecycle interaction;
- duplicate and over-return protection;
- audit requirements;
- risk assessment;
- recommended next mission.

## Accepted Baseline

- Baseline tag:
  `v1-sales-009-invoice-lifecycle-regression-baseline`.
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
- Full Sales / Invoice lifecycle regression PASS through V1-SALES-009.

## Current Status

`V1-SALES-010 Ready for Architect / Owner Review`

## Design Result

- Recommended return storage boundary: `invoiceReturns:{accountId}`.
- Recommended return movement type: positive `sale_return`.
- Recommended movement reference type: `invoice_return`.
- Recommended invoice lifecycle additions: `partially_returned` and `returned`.
- Recommended return persistence mission next:
  `V1-SALES-011 - Account-Scoped Invoice Returns Persistence Baseline`.
- Return UI remains deferred until persistence and runtime rules are verified.

## Scope Confirmation

- No source files changed.
- No returns implementation.
- No partial returns implementation.
- No return UI.
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

## Evidence / Documents

```text
PATCHES/V1-SALES-010/invoice-returns-design-plan.md
PATCHES/V1-SALES-010/return-storage-boundary-plan.md
PATCHES/V1-SALES-010/return-inventory-integration-plan.md
PATCHES/V1-SALES-010/return-lifecycle-risk-assessment.md
PATCHES/V1-SALES-010/closure-report.md
```

## Next

Recommended next step:

Architect / Owner review of V1-SALES-010.

Do not start the next mission until V1-SALES-010 is reviewed and accepted.
