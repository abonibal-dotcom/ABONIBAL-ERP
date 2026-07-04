# Current Mission

## Mission

`V1-SALES-001 - Sales / Invoice Foundation Baseline`

## Classification

`INF`

This is a Sales / Invoice foundation assessment mission.

This is not invoice implementation, invoice UI, invoice create/edit/delete, invoice stock deduction, Product work, Inventory implementation, Auth work, or localStorage migration.

## Objective

Assess the current Sales / Invoice foundation before invoice creation or stock deduction begins.

The assessment proves:

- No Sales / Invoice source module exists yet.
- No invoice route or invoice UI exists yet.
- No invoice persistence or storage key exists yet.
- Products are accepted as the stable invoice line reference dependency.
- Inventory stock availability is accepted as the required future invoice confirmation dependency.
- Invoice implementation should not begin before account-scoped invoice persistence and lifecycle planning.

## Accepted Baseline

- Baseline tag: `v1-inv-007-stock-availability-invoice-gate`.
- Firebase Auth.
- Explicit `accountId`.
- Route Guard.
- Account-scoped Products.
- Product regression PASS through ECS-011.
- Stock Movement Ledger persistence PASS through V1-INV-003.
- Manual Inventory flow PASS through V1-INV-005.
- Inventory current stock/history PASS through V1-INV-006.
- Stock availability gate PASS through V1-INV-007.

## Current Status

`V1-SALES-001 Ready for Architect / Owner Review`

## Runtime Verification Result

- Unauthenticated protected routes are blocked.
- Login succeeds.
- AuthSession.accountId exists.
- Products route works.
- Inventory route works.
- Stock availability gate remains available.
- No invoice route exists.
- No sales route exists.
- No invoice storage keys exist.
- Product scoped key hash before/after is unchanged/null.
- Stock movement count before/after is 0 / 0.
- Console errors: 0.
- Page exceptions: 0.
- `.env` remains untracked.

## Verification Completed

- Pre-check: PASS.
- Document read: PASS.
- Source inspection: PASS.
- TypeScript: PASS.
- Build: PASS.
- Runtime verification: PASS.
- Console errors: 0.
- Page exceptions: 0.

## Scope Confirmation

- No source files changed.
- No Product source files changed.
- No Inventory source files changed.
- No invoice implementation added.
- No invoice UI added.
- No invoice stock deduction added.
- No `sale_deduction` movements created.
- No Product data mutation.
- No Inventory movement mutation.
- No localStorage migration.
- No Auth behavior change.
- No Route Guard weakening.
- No Firebase UID or provider user id as `accountId`.
- No default account fallback.
- No credentials committed.
- `.env` remains untracked.

## Evidence

```text
PATCHES/V1-SALES-001/invoice-foundation-baseline.md
PATCHES/V1-SALES-001/invoice-dependency-assessment.md
PATCHES/V1-SALES-001/verification.md
PATCHES/V1-SALES-001/closure-report.md
outputs/V1-SALES-001/runtime.json
outputs/V1-SALES-001/dom.json
outputs/V1-SALES-001/console.log
outputs/V1-SALES-001/storage-snapshot-sanitized.json
outputs/V1-SALES-001/screenshot.png
```

## Next

Recommended next mission:

`V1-SALES-002 - Account-Scoped Invoice Persistence Design Plan`

Do not start invoice UI or invoice stock deduction before persistence, lifecycle, and storage boundary planning are approved.
