# Current Mission

## Mission

`V1-INV-004 - Stock Movement Ledger Runtime Verification`

## Classification

`ECS`

This is an Inventory ledger runtime hardening and verification mission.

This is not Inventory UI, invoice implementation, Product CRUD, Product quantity migration, route work, Auth redesign, or Product behavior work.

## Objective

Verify and harden the accepted account-scoped Stock Movement Ledger behavior after V1-INV-003.

V1-INV-004 proves the ledger is stable enough to remain the dependency path for future Inventory UI and invoice stock deduction planning.

## Accepted Baseline

- Baseline tag: `v1-inv-003-stock-movement-ledger-persistence-baseline`.
- Firebase Auth.
- Explicit `accountId`.
- Route Guard.
- Account-scoped Products.
- Product CRUD/search regression PASS through ECS-011.
- Stock Movement Ledger persistence PASS through V1-INV-003.

## Current Status

`V1-INV-004 Ready for Architect / Owner Review`

## Runtime Verification Result

- Source fix needed: no.
- Login succeeds.
- AuthSession exists.
- AuthSession.accountId exists.
- accountId is not Firebase UID.
- accountId is not providerUserId.
- Route Guard remains active.
- Scoped key used: `stockMovements:{accountId}`.
- No global stock movement key is used.
- No other account movement key affects current account quantities.
- Opening balance append PASS.
- Manual adjustment append PASS.
- Correction append PASS.
- Invalid append attempts rejected.
- Invalid attempts did not write records.
- Malformed existing record did not crash quantity computation.
- Multi-product current quantity isolation PASS.
- Missing Product reference handled safely.
- Void behavior PASS.
- Re-void behavior safe.
- Non-existing void behavior safe.
- Reload persistence PASS.
- Product storage hashes unchanged.

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

- No source fix was needed.
- No `src/` files changed in V1-INV-004.
- Product records were not mutated.
- `Product.quantity` was not updated.
- `Product.quantity` was not treated as authoritative.
- No Product files changed.
- No Product CRUD behavior changed.
- No Product quantity migration.
- No Inventory UI added.
- No Inventory route added.
- No invoice implementation added.
- No invoice stock deduction.
- No Product legacy data mutation.
- No `localStorage.products` mutation.
- No Route Guard weakening.
- No Auth behavior change.
- No Firebase UID or provider user id as `accountId`.
- No default account fallback.
- No credentials committed.
- `.env` remains untracked.

## Evidence

```text
PATCHES/V1-INV-004/verification.md
PATCHES/V1-INV-004/closure-report.md
outputs/V1-INV-004/runtime.json
outputs/V1-INV-004/dom.json
outputs/V1-INV-004/console.log
outputs/V1-INV-004/storage-snapshot-sanitized.json
outputs/V1-INV-004/screenshot.png
outputs/V1-INV-004/ledger-runtime-summary.json
```

## Next Mission

Recommended next mission:

`V1-INV-005 - Manual Opening Balance / Adjustment Flow`

Do not start the next mission until V1-INV-004 is reviewed and accepted.
