# Current Mission

## Mission

`V1-INV-006 - Inventory Movement History / Current Stock View`

## Classification

`ECS`

This is an Inventory read/reporting stabilization mission.

This is not invoice implementation, invoice stock deduction, Product CRUD, Product quantity migration, Auth redesign, or Product behavior work.

## Objective

Implement and verify a minimal read-only Inventory movement history and current stock view on top of the accepted account-scoped Stock Movement Ledger.

The flow proves:

- Current stock is displayed from ledger computation.
- Movement history is visible from `stockMovements:{AuthSession.accountId}`.
- Movements are listed clearly by Product or productId.
- Voided movements remain visible and are excluded from current quantity.
- Missing Product references do not crash the page.
- Product records are not mutated by Inventory read/history display.
- Invoice work remains blocked.

## Accepted Baseline

- Baseline tag: `v1-inv-005-manual-opening-balance-adjustment-flow`.
- Firebase Auth.
- Explicit `accountId`.
- Route Guard.
- Account-scoped Products.
- Product CRUD/search regression PASS through ECS-011.
- Stock Movement Ledger persistence PASS through V1-INV-003.
- Stock Movement Ledger runtime verification PASS through V1-INV-004.
- Manual Inventory opening balance / adjustment flow PASS through V1-INV-005.

## Current Status

`V1-INV-006 Ready for Architect / Owner Review`

## Runtime Verification Result

- Inventory route is protected by Route Guard.
- Unauthenticated Inventory access redirects/blocks to Login.
- Login succeeds.
- AuthSession exists.
- AuthSession.accountId exists.
- accountId is not Firebase UID.
- accountId is not providerUserId.
- Inventory route is accessible after login.
- Current stock view renders.
- Active Product rows render.
- Current quantity displayed equals ledger computation.
- `Product.quantity` is not authoritative.
- Soft-deleted Products are not shown as active stock rows.
- Movement history renders.
- Opening balance movement appears.
- Manual adjustment movement appears.
- Movement count displayed matches valid ledger count.
- Voided movement is shown as voided.
- Voided movement is excluded from current quantity.
- Missing Product reference does not crash the page.
- Malformed movement record does not crash the page.
- Reload preserves current stock display.
- Reload preserves movement history display.
- Product scoped hash remains unchanged.
- Product records are not mutated by Inventory read/history display.
- `Product.quantity` is not updated.
- Legacy `localStorage.products` remains unchanged if present.
- No invoice implementation added.
- No Product CRUD behavior changed.
- Console errors: 0.
- Page exceptions: 0.

## Verification Completed

- Pre-check: PASS.
- Document read: PASS.
- Source inspection: PASS.
- Baseline runtime: PASS.
- TypeScript: PASS.
- Build: PASS.
- Runtime verification: PASS.
- Console errors: 0.
- Page exceptions: 0.

## Scope Confirmation

- Source file changed only for Inventory read/history UI.
- Product records were not mutated by Inventory read/history display.
- `Product.quantity` was not updated.
- `Product.quantity` was not treated as authoritative.
- No Product files changed.
- No Product CRUD behavior changed.
- No Product quantity migration.
- No invoice implementation added.
- No invoice stock deduction added.
- No Auth behavior change.
- No Route Guard weakening.
- No Firebase UID or provider user id as `accountId`.
- No default account fallback.
- No credentials committed.
- `.env` remains untracked.

## Evidence

```text
PATCHES/V1-INV-006/verification.md
PATCHES/V1-INV-006/closure-report.md
outputs/V1-INV-006/baseline-runtime.json
outputs/V1-INV-006/baseline-dom.json
outputs/V1-INV-006/baseline-console.log
outputs/V1-INV-006/baseline-storage-snapshot-sanitized.json
outputs/V1-INV-006/baseline-screenshot.png
outputs/V1-INV-006/after-runtime.json
outputs/V1-INV-006/after-dom.json
outputs/V1-INV-006/after-console.log
outputs/V1-INV-006/after-storage-snapshot-sanitized.json
outputs/V1-INV-006/after-screenshot.png
outputs/V1-INV-006/inventory-read-summary.json
```

## Next Mission

Recommended next mission:

`V1-INV-007 - Inventory Stock Availability / Invoice Dependency Gate`

Do not start the next mission until V1-INV-006 is reviewed and accepted.
