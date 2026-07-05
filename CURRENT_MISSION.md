# Current Mission

## Mission

`V1-SALES-002 - Account-Scoped Invoice Persistence Design Plan`

## Classification

`INF`

This is a Sales / Invoice design planning mission.

This is not invoice implementation, invoice UI, invoice create/edit/delete, invoice stock deduction, Product work, Inventory implementation, Auth work, routing work, or localStorage migration.

## Objective

Define the implementation-ready account-scoped invoice persistence plan before invoice code begins.

The plan documents:

- Target invoice storage boundary.
- Invoice header and line contract.
- Draft / issued / cancelled lifecycle policy.
- Invoice numbering policy.
- Product snapshot dependency.
- Inventory availability and future stock deduction dependency.
- Risks and the next approved implementation candidate.

## Accepted Baseline

- Baseline tag: `v1-sales-001-invoice-foundation-baseline`.
- Firebase Auth.
- Explicit `accountId`.
- Route Guard.
- Account-scoped Products.
- Product regression PASS through ECS-011.
- Stock Movement Ledger persistence PASS through V1-INV-003.
- Manual Inventory flow PASS through V1-INV-005.
- Inventory current stock/history PASS through V1-INV-006.
- Stock availability gate PASS through V1-INV-007.
- V1-SALES-001 confirmed no invoice module, route, UI, service, repository, persistence key, or storage boundary exists yet.

## Current Status

`V1-SALES-002 Ready for Architect / Owner Review`

## Design Result

- Recommended invoice storage boundary: `invoices:{accountId}`.
- Global `invoices` storage is rejected.
- Firebase UID/provider user id scoped invoice storage is rejected.
- Default account fallback is rejected.
- No invoice legacy migration is recommended because no legacy invoice storage exists in the accepted baseline.
- Recommended V1 lifecycle states: `draft`, `issued`, `cancelled`.
- Recommended numbering policy: `INV-{YYYYMMDD}-{accountLocalSequence}` with uniqueness check inside `invoices:{accountId}`.
- Future invoice lines should reference stable Product ids and store Product snapshot fields.
- Future issuing flow must call the accepted Inventory availability gate before any stock deduction.
- Future stock deduction must create `sale_deduction` movements and must not update `Product.quantity`.

## Verification Completed

- Pre-check: PASS.
- Document read: PASS.
- Source inspection: PASS.
- TypeScript: PASS.
- Build: PASS.
- Runtime verification: not required for this INF design mission.

## Scope Confirmation

- No source files changed.
- No Product source files changed.
- No Inventory source files changed.
- No invoice implementation added.
- No invoice UI added.
- No invoice route added.
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
PATCHES/V1-SALES-002/account-scoped-invoice-persistence-design-plan.md
PATCHES/V1-SALES-002/invoice-lifecycle-plan.md
PATCHES/V1-SALES-002/invoice-numbering-plan.md
PATCHES/V1-SALES-002/invoice-stock-integration-plan.md
PATCHES/V1-SALES-002/closure-report.md
```

## Next

Recommended next mission:

`V1-SALES-003 - Account-Scoped Invoice Persistence Baseline`

Invoice UI and invoice stock deduction remain blocked until the account-scoped invoice persistence baseline is approved and verified.
