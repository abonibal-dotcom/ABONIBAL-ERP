# V1-REL-001 Verification

## Mission

`V1-REL-001 - Full V1 Production Regression / Release Candidate`

## Classification

`ECS`

## Branch

`v1/rel-001-full-v1-production-regression-release-candidate`

## Baseline Tag

`v1-sales-014-sales-lifecycle-regression-including-returns`

## Verification Notes

Two incomplete runtime attempts were rejected before the accepted baseline:

- The first attempt assumed the copied Chrome profile was still authenticated.
  Vite and the app started, but AuthState did not become authenticated before
  evidence capture completed.
- The second attempt inherited V1-SALES-014 baseline gates that required
  pre-existing issued invoice data. V1-REL-001 baseline is allowed to record an
  empty account state before full release regression creates controlled runtime
  fixtures.

Both attempts were treated as verifier/tooling evidence design attempts, not
application failures. They were not used as the accepted baseline.

## Accepted Baseline Runtime

Command:

```text
node outputs/V1-REL-001/verify-runtime.mjs baseline
```

Result: PASS

Accepted baseline evidence:

```text
outputs/V1-REL-001/baseline-runtime.json
outputs/V1-REL-001/baseline-dom.json
outputs/V1-REL-001/baseline-console.log
outputs/V1-REL-001/baseline-storage-snapshot-sanitized.json
outputs/V1-REL-001/baseline-screenshot.png
```

Baseline confirmed Login, Dashboard, Products, Inventory, and Invoices routes
load through the authenticated release verification environment, the Route
Guard remains active, scoped storage keys are inspected read-only, console
errors are zero, page exceptions are zero, and `.env` remains untracked.

## Static Verification

Command:

```text
pnpm exec tsc --noEmit
```

Result: PASS

## Build Verification

Command:

```text
pnpm run build
```

Result: PASS

Build completed successfully. Vite reported a non-blocking chunk-size warning.

## Full V1 Runtime Regression

Command:

```text
node outputs/V1-REL-001/verify-runtime.mjs after
```

Result: PASS

Final evidence:

```text
outputs/V1-REL-001/after-runtime.json
outputs/V1-REL-001/after-dom.json
outputs/V1-REL-001/after-console.log
outputs/V1-REL-001/after-storage-snapshot-sanitized.json
outputs/V1-REL-001/after-screenshot.png
outputs/V1-REL-001/full-v1-release-candidate-summary.json
outputs/V1-REL-001/verify-runtime.mjs
```

Visual screenshots:

```text
outputs/V1-REL-001/screenshots/login-page.png
outputs/V1-REL-001/screenshots/dashboard.png
outputs/V1-REL-001/screenshots/products-page.png
outputs/V1-REL-001/screenshots/inventory-page.png
outputs/V1-REL-001/screenshots/invoice-draft-page.png
outputs/V1-REL-001/screenshots/issued-invoice-audit.png
outputs/V1-REL-001/screenshots/cancelled-invoice-audit.png
outputs/V1-REL-001/screenshots/invoice-return-ui.png
```

## Runtime Gate Summary

- Auth / Login / Logout: PASS.
- Route Guard: PASS.
- Dashboard / Navigation: PASS.
- Products: PASS.
- Inventory: PASS.
- Sales Draft: PASS.
- Invoice Issue / Stock Deduction: PASS.
- Issued Invoice Audit: PASS.
- Invoice Cancellation / Stock Reversal: PASS.
- Invoice Returns: PASS.
- Storage boundaries: PASS.
- Reload persistence: PASS.
- Product safety: PASS.
- Inventory ledger correctness: PASS.
- Console errors: 0.
- Page exceptions: 0.
- `.env` tracked by Git: no.

## Scope Confirmation

- No source files changed.
- No new feature implementation.
- No UI redesign.
- No deployment.
- No Firebase configuration mutation.
- No localStorage migration.
- No hard-delete of Products, invoices, returns, or stock movements.
- No `Product.quantity` mutation.
- No Auth weakening.
- No Route Guard weakening.
- No Firebase UID or provider user id used as `accountId`.
- No default account fallback.

## Final Result

`V1-REL-001 Runtime Verification PASS`
