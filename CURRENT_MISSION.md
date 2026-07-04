# Current Mission

## Mission

`V1-INV-005 - Manual Opening Balance / Adjustment Flow`

## Classification

`ECS`

This is the first minimal Inventory UI / manual stock movement flow.

This is not invoice implementation, invoice stock deduction, Product CRUD, Product quantity migration, Auth redesign, or Product behavior work.

## Objective

Implement and verify a minimal authenticated Inventory flow that allows an owner/user to create manual stock movements through the accepted account-scoped Stock Movement Ledger.

The flow supports:

- Opening balance movement.
- Manual adjustment movement.
- Current quantity display computed from ledger movements.
- Product selection from active account-scoped Products.
- Storage only in `stockMovements:{AuthSession.accountId}`.

## Accepted Baseline

- Baseline tag: `v1-inv-004-stock-movement-ledger-runtime-verification`.
- Firebase Auth.
- Explicit `accountId`.
- Route Guard.
- Account-scoped Products.
- Product CRUD/search regression PASS through ECS-011.
- Stock Movement Ledger persistence PASS through V1-INV-003.
- Stock Movement Ledger runtime verification PASS through V1-INV-004.

## Current Status

`V1-INV-005 Ready for Architect / Owner Review`

## Runtime Verification Result

- Inventory route is protected by Route Guard.
- Unauthenticated Inventory access redirects/blocks to Login.
- Login succeeds.
- AuthSession exists.
- AuthSession.accountId exists.
- accountId is not Firebase UID.
- accountId is not providerUserId.
- Inventory route is accessible after login.
- Inventory page renders.
- Product selector uses active Products returned from `ProductService.getAll()`.
- Soft-deleted Products are not selectable.
- Invalid opening balance does not write.
- Valid opening balance writes one movement to `stockMovements:{accountId}`.
- Invalid manual adjustment does not write.
- Valid manual adjustment writes one movement to `stockMovements:{accountId}`.
- Current quantity updates from 0 to 10 after opening balance.
- Current quantity updates to 7 after manual adjustment.
- Reload preserves movement records and displayed current quantity.
- Product scoped hash remains unchanged after Inventory UI actions.
- Product records are not mutated by the Inventory flow.
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

- Source files changed only for Inventory UI and route/navigation access.
- Product records were not mutated by Inventory movement submission.
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
PATCHES/V1-INV-005/verification.md
PATCHES/V1-INV-005/closure-report.md
outputs/V1-INV-005/baseline-runtime.json
outputs/V1-INV-005/baseline-dom.json
outputs/V1-INV-005/baseline-console.log
outputs/V1-INV-005/baseline-storage-snapshot-sanitized.json
outputs/V1-INV-005/baseline-screenshot.png
outputs/V1-INV-005/after-runtime.json
outputs/V1-INV-005/after-dom.json
outputs/V1-INV-005/after-console.log
outputs/V1-INV-005/after-storage-snapshot-sanitized.json
outputs/V1-INV-005/after-screenshot.png
outputs/V1-INV-005/inventory-flow-summary.json
```

## Next Mission

Recommended next mission:

`V1-INV-006 - Inventory Movement Regression / Reporting Baseline`

Do not start the next mission until V1-INV-005 is reviewed and accepted.
