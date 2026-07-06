# Current Mission

## Mission

`V1-REL-001 - Full V1 Production Regression / Release Candidate`

## Classification

`ECS`

This is a full V1 production regression and release-candidate verification
mission.

This is not new feature implementation, UI redesign, refactor, deployment, or
localStorage migration.

## Objective

Verify the full accepted ABONIBAL ERP V1 application as a Release Candidate:

- Auth / Login / Logout.
- Route Guard.
- Dashboard and navigation.
- Account-scoped Products.
- Product CRUD / Search / Soft Delete.
- Inventory Ledger.
- Manual Inventory Movements.
- Current Stock View.
- Stock Availability Gate.
- Invoice Draft Create / Update.
- Invoice Issue / Stock Deduction.
- Issued Invoice Audit.
- Invoice Cancellation / Stock Reversal.
- Invoice Returns Persistence.
- Invoice Returns Execution.
- Invoice Returns UI.
- Reload persistence.
- Storage boundaries.
- Product safety.
- Inventory ledger correctness.

## Accepted Baseline

- Baseline tag: `v1-sales-014-sales-lifecycle-regression-including-returns`.
- Firebase Auth.
- Explicit `accountId`.
- Route Guard.
- Account-scoped Products through ECS-011.
- Inventory ledger and availability gate through V1-INV-007.
- Sales / Invoice lifecycle through V1-SALES-014.
- Return persistence, execution, and UI through V1-SALES-014.

## Current Status

`V1-REL-001 Ready for Architect / Owner Review`

## Implementation Result

No application source fix was needed.

V1-REL-001 added release-candidate runtime verification evidence and
documentation only.

## Verification Result

- TypeScript: PASS.
- Build: PASS.
- Runtime: PASS.
- Console errors: 0.
- Page exceptions: 0.
- Screenshots captured: 8.
- Runtime evidence saved under `outputs/V1-REL-001/`.

## Scope Confirmation

- No source files changed.
- No new feature implemented.
- No UI redesign.
- No deployment performed.
- No Firebase configuration change.
- No localStorage migration.
- No hard delete of Products, invoices, returns, or stock movements.
- `Product.quantity` remained non-authoritative.
- Route Guard remained active.
- No Auth weakening.
- No Firebase UID or provider user id used as `accountId`.
- No default account fallback.
- `.env` remains untracked.

## Evidence / Documents

```text
outputs/V1-REL-001/baseline-runtime.json
outputs/V1-REL-001/baseline-dom.json
outputs/V1-REL-001/baseline-console.log
outputs/V1-REL-001/baseline-storage-snapshot-sanitized.json
outputs/V1-REL-001/baseline-screenshot.png
outputs/V1-REL-001/after-runtime.json
outputs/V1-REL-001/after-dom.json
outputs/V1-REL-001/after-console.log
outputs/V1-REL-001/after-storage-snapshot-sanitized.json
outputs/V1-REL-001/after-screenshot.png
outputs/V1-REL-001/full-v1-release-candidate-summary.json
outputs/V1-REL-001/screenshots/
PATCHES/V1-REL-001/verification.md
PATCHES/V1-REL-001/closure-report.md
```

## Next

Recommended next step:

Architect / Owner review of V1-REL-001.

Do not start the next mission until V1-REL-001 is reviewed and accepted.
