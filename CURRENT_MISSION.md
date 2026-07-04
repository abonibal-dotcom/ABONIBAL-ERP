# Current Mission

## Mission

`V1-INV-007 - Inventory Stock Availability / Invoice Dependency Gate`

## Classification

`ECS`

This is an Inventory stock availability service/gate mission.

This is not invoice implementation, invoice UI, invoice stock deduction, Product CRUD, Product quantity migration, Auth redesign, or Product behavior work.

## Objective

Implement and verify a minimal account-scoped stock availability gate that future invoice code can depend on safely.

The gate proves:

- Current available quantity for an active Product is computed from the ledger.
- A requested quantity can be accepted or rejected without writing stock movements.
- Shortage quantity is reported when stock is insufficient.
- Missing Product references fail safely.
- Soft-deleted Products fail safely.
- `Product.quantity` is not authoritative and is not updated.
- Invoice work remains blocked.

## Accepted Baseline

- Baseline tag: `v1-inv-006-inventory-movement-history-current-stock-view`.
- Firebase Auth.
- Explicit `accountId`.
- Route Guard.
- Account-scoped Products.
- Product CRUD/search regression PASS through ECS-011.
- Stock Movement Ledger persistence PASS through V1-INV-003.
- Stock Movement Ledger runtime verification PASS through V1-INV-004.
- Manual Inventory opening balance / adjustment flow PASS through V1-INV-005.
- Inventory current stock/history view PASS through V1-INV-006.

## Current Status

`V1-INV-007 Ready for Architect / Owner Review`

## Runtime Verification Result

- Inventory route is protected by Route Guard.
- Unauthenticated Inventory access redirects/blocks to Login.
- Login succeeds.
- AuthSession exists.
- AuthSession.accountId exists.
- accountId is not Firebase UID.
- accountId is not providerUserId.
- Inventory route is accessible after login.
- Availability reads `stockMovements:{accountId}`.
- Available quantity equals ledger current quantity.
- In-stock request returns `canFulfill = true`.
- Over-stock request returns `canFulfill = false`.
- Shortage quantity is correct.
- Missing productId is rejected.
- Missing Product reference is rejected.
- Non-numeric requested quantity is rejected.
- Zero requested quantity is rejected.
- Negative requested quantity is rejected.
- Soft-deleted Product is not fulfillable.
- Voided movements are excluded from availability.
- Availability checks do not create stock movements.
- Availability checks do not mutate Product records.
- Reload preserves availability results.
- Product scoped hash remains unchanged.
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

- Source changes are limited to Inventory service and required Container wiring.
- Product records were not mutated by availability checks.
- `Product.quantity` was not updated.
- `Product.quantity` was not treated as authoritative.
- No Product files changed.
- No Product CRUD behavior changed.
- No Product quantity migration.
- No invoice implementation added.
- No invoice stock deduction added.
- No `sale_deduction` movement creation added.
- No Auth behavior change.
- No Route Guard weakening.
- No Firebase UID or provider user id as `accountId`.
- No default account fallback.
- No credentials committed.
- `.env` remains untracked.

## Evidence

```text
PATCHES/V1-INV-007/verification.md
PATCHES/V1-INV-007/closure-report.md
outputs/V1-INV-007/baseline-runtime.json
outputs/V1-INV-007/baseline-dom.json
outputs/V1-INV-007/baseline-console.log
outputs/V1-INV-007/baseline-storage-snapshot-sanitized.json
outputs/V1-INV-007/baseline-screenshot.png
outputs/V1-INV-007/after-runtime.json
outputs/V1-INV-007/after-dom.json
outputs/V1-INV-007/after-console.log
outputs/V1-INV-007/after-storage-snapshot-sanitized.json
outputs/V1-INV-007/after-screenshot.png
outputs/V1-INV-007/availability-summary.json
```

## Next

Await Architect / Owner review.

Do not start the next mission from this file alone.
