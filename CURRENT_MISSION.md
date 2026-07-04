# Current Mission

## Mission

`V1-INV-001 - Inventory / Stock Foundation Baseline`

## Classification

`INF`

This is an inventory / stock foundation assessment mission.

This is not Inventory implementation, stock adjustment, invoices, Product work, Product migration, Auth work, or Product behavior change.

## Objective

Assess the current Inventory / Stock foundation before implementing stock operations or invoice integration.

The goal is to determine:

- Whether any Inventory / Stock module already exists.
- Whether Products currently have stock-related fields.
- Whether stock quantity is stored directly on Product records or in a separate stock ledger.
- Whether the accepted Product module can safely become a dependency for Inventory.
- Whether Inventory should use account-scoped persistence.
- Whether stock movements require a ledger model before invoice work.
- What the safest next Inventory mission should be.

## Current Status

`V1-INV-001 Ready for Architect / Owner Review`

## Verification Completed

- Pre-check: PASS.
- Document read: PASS.
- Source inspection: PASS.
- TypeScript: PASS.
- Build: PASS.
- Read-only Runtime Verification: PASS.
- Console errors: 0.
- Page exceptions: 0.

## Assessment Result

- No standalone Inventory / Stock module exists.
- No Inventory route exists.
- No Inventory UI exists.
- No Stock service or repository exists.
- No Inventory / Stock storage key exists.
- Product records are modeled with `quantity` and `minimumQuantity`.
- Current Product create/edit UI does not actively manage stock quantity.
- Current Product persistence is account-scoped through `products:{accountId}`.
- Runtime verification observed no Product storage mutation.
- Runtime verification observed no legacy `localStorage.products` mutation.
- Runtime verification observed no inventory storage keys.

## Recommendation

V1 Inventory should use an account-scoped stock movement ledger as the authoritative stock model.

Recommended next mission:

`V1-INV-002 - Account-Scoped Stock Movement Ledger Design Plan`

Invoices should not proceed to stock deduction before Inventory movement semantics are approved and verified.

## Scope Confirmation

- No source files changed.
- No Product files changed.
- No Auth files changed.
- No Inventory implementation added.
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
PATCHES/V1-INV-001/inventory-stock-foundation-baseline.md
PATCHES/V1-INV-001/verification.md
PATCHES/V1-INV-001/closure-report.md
outputs/V1-INV-001/runtime.json
outputs/V1-INV-001/dom.json
outputs/V1-INV-001/console.log
outputs/V1-INV-001/storage-snapshot-sanitized.json
outputs/V1-INV-001/screenshot.png
```

## Next Mission

Await Architect / Owner review.

Do not start the next mission until V1-INV-001 is reviewed and accepted.
