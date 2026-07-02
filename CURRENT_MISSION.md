# Current Mission

## Mission

`V1-PER-006 - Legacy Product Scoped Import`

## Classification

`ECS`

This is a controlled no-data-loss legacy Product import mission.

This is not Product Create/Edit/Delete UI work, Product search/filter work, destructive migration, Auth redesign, Route Guard change, Firebase Auth change, Inventory work, Sales work, Sync work, or ECS-007.

## Objective

Copy owner-approved legacy Product records from `localStorage.products` into the current authenticated account-scoped key `products:{accountId}` while preserving the legacy key.

## Current Status

`V1-PER-006 Ready for Architect / Owner Review`

## Verification Completed

- Baseline evidence: PASS.
- TypeScript: PASS.
- Build: PASS.
- Runtime Verification: PASS.
- Console errors: 0.
- Page exceptions: 0.

## Runtime Result

- Baseline confirmed legacy `products` exists with one Product.
- Baseline confirmed scoped `products:{accountId}` was empty.
- Baseline confirmed legacy Products were not visible in the Products UI before import.
- Import copied one legacy Product into `products:{accountId}`.
- Import attached `accountId`, `createdBy`, and `updatedBy`.
- Existing scoped Products were preserved.
- Duplicate import did not duplicate Products.
- Backup keys were created.
- Legacy `localStorage.products` remained present and hash unchanged.
- Products UI rendered the scoped Products after import.

## Scope Confirmation

- No Product Create/Edit/Delete UI.
- No Product search/filter feature.
- No destructive migration.
- No legacy Product deletion.
- No automatic import on app startup.
- No Route Guard weakening.
- No Firebase Auth change.
- No persistence driver change.
- No Firebase UID or provider user id as `accountId`.
- No default account fallback.
- No credentials committed.
- `.env` remains untracked.

## Evidence

```text
PATCHES/V1-PER-006/verification.md
PATCHES/V1-PER-006/closure-report.md
outputs/V1-PER-006/baseline-runtime.json
outputs/V1-PER-006/baseline-dom.json
outputs/V1-PER-006/baseline-console.log
outputs/V1-PER-006/baseline-storage-snapshot-sanitized.json
outputs/V1-PER-006/baseline-screenshot.png
outputs/V1-PER-006/after-runtime.json
outputs/V1-PER-006/after-dom.json
outputs/V1-PER-006/after-console.log
outputs/V1-PER-006/after-storage-snapshot-sanitized.json
outputs/V1-PER-006/after-screenshot.png
outputs/V1-PER-006/import-summary.json
```

## Next Mission

Await Architect / Owner review.

Do not start Product Create/Edit/Delete until V1-PER-006 is reviewed and accepted.
