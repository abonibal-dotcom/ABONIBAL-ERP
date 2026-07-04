# Current Mission

## Mission

`V1-INV-002 - Account-Scoped Stock Movement Ledger Design Plan`

## Classification

`INF`

This is an Inventory architecture and persistence design mission.

This is not Inventory implementation, invoice implementation, Product work, stock adjustment, stock deduction, UI work, or migration execution.

## Objective

Design the V1 account-scoped Inventory / Stock Movement Ledger before implementing stock operations or invoice stock deduction.

The design must be implementation-ready while preserving current accepted foundations:

- Firebase Auth.
- Explicit `accountId`.
- Route Guard.
- Account-scoped Products.
- Product CRUD/search regression PASS.
- Inventory foundation assessment PASS.

## Current Status

`V1-INV-002 Ready for Architect / Owner Review`

## Design Result

- Authoritative Inventory model: account-scoped stock movement ledger.
- Authoritative storage boundary: `stockMovements:{accountId}`.
- Optional future derived cache: `inventorySnapshots:{accountId}`.
- Product reference: stable `Product.id`.
- Product quantity policy: `Product.quantity` remains legacy/display-compatible and must not become the source of truth.
- Current quantity computation: sum non-voided `quantityDelta` values grouped by `productId` for the current `accountId`.
- Invoice dependency: invoices must create stock movements and must not directly edit `Product.quantity`.
- Invoice stock deduction remains blocked until Inventory persistence is implemented and verified.

## Verification Completed

- Pre-check: PASS.
- Document read: PASS.
- Source inspection: PASS.
- TypeScript: PASS.
- Build: PASS.
- Runtime mutation: not required and not performed.

## Scope Confirmation

- No source files changed.
- No Product files changed.
- No Inventory implementation added.
- No Inventory route added.
- No Inventory UI added.
- No Invoice implementation added.
- No Product data mutation.
- No localStorage migration.
- No legacy Product deletion.
- No Route Guard weakening.
- No Firebase UID or provider user id as `accountId`.
- No default account fallback.
- No credentials committed.
- `.env` remains untracked.

## Evidence

```text
PATCHES/V1-INV-002/stock-movement-ledger-design-plan.md
PATCHES/V1-INV-002/inventory-storage-boundary-plan.md
PATCHES/V1-INV-002/invoice-stock-dependency-plan.md
PATCHES/V1-INV-002/closure-report.md
```

## Next Mission

Recommended next mission:

`V1-INV-003 - Stock Movement Ledger Persistence Baseline`

Do not start the next mission until V1-INV-002 is reviewed and accepted.
