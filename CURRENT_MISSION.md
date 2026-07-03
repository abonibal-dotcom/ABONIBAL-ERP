# Current Mission

## Mission

`ECS-010 - Product Search / Filter Path`

## Classification

`ECS`

This is a Product Search / Filter stabilization mission.

This is not Product Create, Product Edit, Product Delete, Product migration, Auth redesign, Route Guard change, Inventory work, Sales work, Sync work, or ECS-011.

## Objective

Implement and verify the minimal Product Search / Filter path on top of the accepted account-scoped Product persistence foundation.

Search / Filter operates only on active Products returned from `ProductService.getAll()` and therefore indirectly uses `products:{AuthSession.accountId}`. It does not read from or mutate legacy `localStorage.products`.

## Current Status

`ECS-010 Ready for Architect / Owner Review`

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
- Baseline confirmed active Products exclude deleted records.
- Baseline confirmed the Product search input existed but did not filter results.
- Minimal fix connected the existing Product search input to active Product filtering.
- Matching Product name search returned the expected active Product.
- Non-matching search returned zero active Products and showed the no-results state.
- Search using a deleted Product query returned zero active Products.
- Clearing search restored the full active Product list.
- Search did not mutate scoped Product storage.
- Legacy `localStorage.products` remained present and hash unchanged.

## Scope Confirmation

- No Product Create behavior change.
- No Product Edit behavior change.
- No Product Delete behavior change.
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
PATCHES/ECS-010/verification.md
PATCHES/ECS-010/closure-report.md
outputs/ECS-010/baseline-runtime.json
outputs/ECS-010/baseline-dom.json
outputs/ECS-010/baseline-console.log
outputs/ECS-010/baseline-storage-snapshot-sanitized.json
outputs/ECS-010/baseline-screenshot.png
outputs/ECS-010/after-runtime.json
outputs/ECS-010/after-dom.json
outputs/ECS-010/after-console.log
outputs/ECS-010/after-storage-snapshot-sanitized.json
outputs/ECS-010/after-screenshot.png
outputs/ECS-010/search-summary.json
```

## Next Mission

Await Architect / Owner review.

Do not start the next mission until ECS-010 is reviewed and accepted.
