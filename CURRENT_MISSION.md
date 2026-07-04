# Current Mission

## Mission

`V1-INV-003 - Stock Movement Ledger Persistence Baseline`

## Classification

`ECS`

This is the first Inventory persistence implementation mission.

This is not Inventory UI, invoice implementation, Product CRUD, Product quantity migration, route work, Auth redesign, or Product behavior work.

## Objective

Implement the minimal account-scoped Stock Movement Ledger persistence baseline using:

```text
stockMovements:{AuthSession.accountId}
```

The ledger is the future authoritative source for Inventory movement history and current quantity computation.

## Accepted Baseline

- Baseline tag: `v1-inv-002-stock-movement-ledger-design-plan`.
- Firebase Auth.
- Explicit `accountId`.
- Route Guard.
- Account-scoped Products.
- Product CRUD/search regression PASS through ECS-011.
- Inventory foundation assessment PASS.
- Inventory ledger design accepted through V1-INV-002.

## Current Status

`V1-INV-003 Ready for Architect / Owner Review`

## Implementation Result

- Added a minimal Inventory module boundary under `src/modules/inventory/`.
- Added stock movement model/types.
- Added `stockMovements:{accountId}` persistence key helper.
- Added stock movement repository.
- Added stock movement validator.
- Added Inventory service.
- Registered Inventory dependencies in `Container`.
- Current quantity is computed from non-voided movement `quantityDelta` values.
- Voiding marks a movement as voided and preserves the original record.

## Verification Completed

- Pre-check: PASS.
- Document read: PASS.
- Source inspection: PASS.
- TypeScript: PASS.
- Build: PASS.
- Runtime verification: PASS.
- Console errors: 0.
- Page exceptions: 0.

## Runtime Result

- Login succeeds.
- AuthSession exists.
- AuthSession.accountId exists.
- accountId is not Firebase UID.
- accountId is not providerUserId.
- Route Guard remains active.
- Scoped key used: `stockMovements:{accountId}`.
- No global stock movement key is used.
- Opening balance write PASS.
- Manual adjustment write PASS.
- Current quantity before void: 7.
- Current quantity after void: 10.
- Voided movement remains stored.
- Movement count does not decrease after void.
- Reload preserves ledger and computed quantity.
- Product scoped storage hash remains unchanged.
- Legacy `localStorage.products` hash remains unchanged.

## Scope Confirmation

- Product records were not mutated.
- `Product.quantity` was not made authoritative.
- No Product files changed.
- No Product CRUD behavior changed.
- No Inventory UI added.
- No Inventory route added.
- No invoice implementation added.
- No Product quantity migration.
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
PATCHES/V1-INV-003/verification.md
PATCHES/V1-INV-003/closure-report.md
outputs/V1-INV-003/runtime.json
outputs/V1-INV-003/dom.json
outputs/V1-INV-003/console.log
outputs/V1-INV-003/storage-snapshot-sanitized.json
outputs/V1-INV-003/screenshot.png
outputs/V1-INV-003/ledger-summary.json
```

## Next Mission

Recommended next mission:

`V1-INV-004 - Stock Movement Append / Current Quantity Runtime Verification`

Do not start the next mission until V1-INV-003 is reviewed and accepted.
