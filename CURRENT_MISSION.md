# Current Mission

## Mission

`V1-PER-005 - Product Account-Scoped Persistence Compatibility Layer`

## Classification

`ECS`

This is a Product persistence compatibility mission.

This is not Product Create/Edit/Delete UI work, Product search/filter work, legacy storage migration, Auth redesign, Route Guard change, Firebase Auth change, Inventory work, Sales work, Sync work, or ECS-007.

## Objective

Implement the minimal account-scoped Product persistence compatibility layer before Product CRUD.

## Current Status

`V1-PER-005 Ready for Architect / Owner Review`

## Verification Completed

- Baseline evidence: PASS.
- Root cause confirmation: PASS.
- TypeScript: PASS.
- Build: PASS.
- Runtime Verification: PASS.
- Console errors: 0.
- Page exceptions: 0.

## Runtime Result

- Baseline confirmed Product reads used legacy `products`.
- Baseline confirmed the current account scoped key was not read.
- After implementation Product reads use `products:{accountId}`.
- Empty scoped storage renders an empty Product list.
- Malformed scoped storage does not crash.
- A scoped verification Product renders from `products:{accountId}`.
- Legacy `localStorage.products` remains present and unchanged.
- No legacy Product migration was executed.

## Scope Confirmation

- Product ownership metadata was added as optional fields only.
- Product repository/service now use account-scoped Product persistence.
- ProductService is wired to the existing AuthStateService.
- No Product Create/Edit/Delete UI.
- No Product search/filter feature.
- No legacy localStorage migration.
- No legacy Product deletion.
- No Route Guard weakening.
- No Firebase Auth change.
- No persistence driver change.
- No Firebase UID or provider user id as `accountId`.
- No default account fallback.
- No credentials committed.
- `.env` remains untracked.

## Evidence

```text
PATCHES/V1-PER-005/verification.md
PATCHES/V1-PER-005/closure-report.md
outputs/V1-PER-005/baseline-runtime.json
outputs/V1-PER-005/baseline-dom.json
outputs/V1-PER-005/baseline-console.log
outputs/V1-PER-005/baseline-storage-snapshot-sanitized.json
outputs/V1-PER-005/baseline-screenshot.png
outputs/V1-PER-005/after-runtime.json
outputs/V1-PER-005/after-dom.json
outputs/V1-PER-005/after-console.log
outputs/V1-PER-005/after-storage-snapshot-sanitized.json
outputs/V1-PER-005/after-screenshot.png
```

## Next Mission

Await Architect / Owner review.

Do not start Product Create/Edit/Delete until V1-PER-005 is reviewed and accepted.
