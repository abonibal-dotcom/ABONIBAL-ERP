# Current Mission

## Mission

`ECS-009 - Product Safe Delete Path`

## Classification

`ECS`

This is a Product safe delete / soft delete stabilization mission.

This is not Product Search / Filter, hard delete, legacy migration, Auth redesign, Route Guard change, Inventory work, Sales work, Sync work, or ECS-010.

## Objective

Implement and verify the minimal Product safe delete path on top of the accepted account-scoped Product persistence foundation.

Deleted Products are marked with backward-compatible metadata in `products:{AuthSession.accountId}`, hidden from the active Products list, and legacy `localStorage.products` is never mutated.

## Current Status

`ECS-009 Ready for Architect / Owner Review`

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
- Baseline confirmed Product Edit exists from ECS-008.
- Baseline confirmed no Product Safe Delete UI/action existed.
- Minimal fix added a Product Safe Delete action per Product row.
- Cancelled delete did not update Product data.
- Confirmed safe delete marked exactly one Product as deleted.
- Deleted Product remained in `products:{accountId}`.
- Deleted Product kept the same `id`.
- Deleted Product kept the same `accountId`.
- Deleted Product preserved `createdBy`.
- Deleted Product received safe-delete metadata.
- Active Product count decreased from 3 to 2.
- Total stored Product record count remained 3.
- Deleted Product remained hidden after reload.
- Legacy `localStorage.products` remained present and hash unchanged.

## Scope Confirmation

- No hard delete.
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
PATCHES/ECS-009/verification.md
PATCHES/ECS-009/closure-report.md
outputs/ECS-009/baseline-runtime.json
outputs/ECS-009/baseline-dom.json
outputs/ECS-009/baseline-console.log
outputs/ECS-009/baseline-storage-snapshot-sanitized.json
outputs/ECS-009/baseline-screenshot.png
outputs/ECS-009/after-runtime.json
outputs/ECS-009/after-dom.json
outputs/ECS-009/after-console.log
outputs/ECS-009/after-storage-snapshot-sanitized.json
outputs/ECS-009/after-screenshot.png
outputs/ECS-009/delete-summary.json
```

## Next Mission

Await Architect / Owner review.

Do not start Product Search / Filter until ECS-009 is reviewed and accepted.
