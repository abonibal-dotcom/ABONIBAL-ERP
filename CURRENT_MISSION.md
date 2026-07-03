# Current Mission

## Mission

`ECS-007 - Product Create Path`

## Classification

`ECS`

This is a Product Create stabilization mission.

This is not Product Edit, Product Delete, Product Search / Filter, legacy migration, Auth redesign, Route Guard change, Inventory work, Sales work, Sync work, or ECS-008.

## Objective

Implement and verify the minimal Product Create path on top of the accepted account-scoped Product persistence foundation.

New Products are created only in `products:{AuthSession.accountId}` and are never written to legacy `localStorage.products`.

## Current Status

`ECS-007 Ready for Architect / Owner Review`

## Verification Completed

- Baseline evidence: PASS.
- TypeScript: PASS.
- Build: PASS.
- Runtime Verification: PASS.
- Console errors: 0.
- Page exceptions: 0.

## Runtime Result

- Baseline confirmed unauthenticated Products access is blocked by Route Guard.
- Baseline confirmed Firebase login succeeds and `AuthSession.accountId` exists.
- Baseline confirmed Products render from `products:{accountId}`.
- Baseline confirmed Product Create button, dialog, and Save button exist.
- Baseline confirmed Save was not connected to a working Product Create path.
- Minimal fix connected the existing dialog values to `ProductFactory` and `ProductService.add()`.
- Invalid create attempt did not write a Product.
- Valid create wrote exactly one Product to `products:{accountId}`.
- Created Product includes `accountId`, `createdBy`, and `updatedBy`.
- Created Product appears in the Products UI.
- Created Product remains visible after reload.
- Legacy `localStorage.products` remained present and hash unchanged.

## Scope Confirmation

- No Product Edit UI.
- No Product Delete UI.
- No Product Search / Filter feature.
- No destructive migration.
- No legacy Product deletion.
- No legacy `localStorage.products` mutation.
- No Route Guard weakening.
- No Firebase Auth change.
- No persistence driver change.
- No Firebase UID or provider user id as `accountId`.
- No default account fallback.
- No credentials committed.
- `.env` remains untracked.

## Evidence

```text
PATCHES/ECS-007/verification.md
PATCHES/ECS-007/closure-report.md
outputs/ECS-007/baseline-runtime.json
outputs/ECS-007/baseline-dom.json
outputs/ECS-007/baseline-console.log
outputs/ECS-007/baseline-storage-snapshot-sanitized.json
outputs/ECS-007/baseline-screenshot.png
outputs/ECS-007/after-runtime.json
outputs/ECS-007/after-dom.json
outputs/ECS-007/after-console.log
outputs/ECS-007/after-storage-snapshot-sanitized.json
outputs/ECS-007/after-screenshot.png
outputs/ECS-007/create-summary.json
```

## Next Mission

Await Architect / Owner review.

Do not start Product Edit/Delete until ECS-007 is reviewed and accepted.
