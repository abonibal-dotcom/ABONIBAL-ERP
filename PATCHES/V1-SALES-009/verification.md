# V1-SALES-009 Verification

## Mission

`V1-SALES-009 - Sales / Invoice Lifecycle Regression Baseline`

## Classification

ECS.

## Baseline Tag

`v1-sales-008-invoice-cancellation-stock-reversal-implementation`

## Verification Summary

Result: PASS.

No source fix was needed.

## Commands

```text
pnpm exec tsc --noEmit
pnpm run build
node outputs/V1-SALES-009/verify-runtime.mjs baseline
node outputs/V1-SALES-009/verify-runtime.mjs after
```

## TypeScript

PASS.

## Build

PASS.

Build completed successfully. The Vite chunk-size warning is informational and
did not fail the build.

## Baseline Runtime

PASS.

Baseline evidence was collected before any source changes.

Baseline proved:

- authenticated session exists;
- explicit `accountId` exists;
- accountId is not the Firebase provider user id;
- Invoice route is protected;
- Products route works;
- Inventory route works;
- Invoice route works;
- issued invoice audit view is visible;
- existing `sale_deduction` trace is visible;
- Product scoped storage hash is stable during read-only baseline;
- legacy `localStorage.products` is stable/absent during read-only baseline;
- console errors = 0;
- page exceptions = 0;
- `.env` remains untracked.

## Full Lifecycle Runtime

PASS.

Runtime verification proved:

- invalid draft submission does not write invoice records;
- valid draft create writes one invoice to `invoices:{accountId}`;
- draft invoice has status `draft`, accountId, createdBy, Product snapshot, and correct totals;
- draft update preserves invoice id/accountId and persists changed totals;
- draft update does not create stock movements;
- insufficient-stock issue is blocked;
- failed issue leaves invoice as `draft`;
- failed issue creates no `sale_deduction`;
- successful issue sets status `issued`;
- successful issue sets `issuedAt`;
- successful issue preserves invoice id/accountId;
- successful issue creates one negative `sale_deduction`;
- invoice line `stockMovementId` references the created deduction movement;
- availability decreases from 3 to 1 after issue;
- duplicate issue creates no duplicate `sale_deduction`;
- issued invoice audit view remains visible after reload;
- draft cancellation is blocked;
- issued invoice cancellation succeeds;
- invoice status becomes `cancelled`;
- `cancelledAt` and `cancelledBy` are set;
- original `sale_deduction` remains stored;
- one positive `sale_return` is created;
- `sale_return` references the original `stockMovementId`;
- availability restores from 1 to 3 after cancellation;
- duplicate cancellation creates no duplicate `sale_return`;
- reload preserves draft, issued, and cancelled invoice records;
- reload preserves `sale_deduction` and `sale_return`;
- reload preserves audit traceability;
- availability after reload matches ledger computation;
- Product scoped storage hash remains unchanged;
- `Product.quantity` remains unchanged;
- legacy `localStorage.products` remains unchanged/absent;
- returns implementation is absent;
- console errors = 0;
- page exceptions = 0;
- `.env` remains untracked.

## Runtime Metrics

```text
Availability before issue: 3
Availability after issue: 1
Availability after cancellation: 3
Availability after reload: 3
Invoice count before: 2
Invoice count after: 4
Stock movement count before: 2
Stock movement count after: 4
Console errors: 0
Page exceptions: 0
```

## Evidence Files

```text
outputs/V1-SALES-009/baseline-runtime.json
outputs/V1-SALES-009/baseline-dom.json
outputs/V1-SALES-009/baseline-console.log
outputs/V1-SALES-009/baseline-storage-snapshot-sanitized.json
outputs/V1-SALES-009/baseline-screenshot.png
outputs/V1-SALES-009/after-runtime.json
outputs/V1-SALES-009/after-dom.json
outputs/V1-SALES-009/after-console.log
outputs/V1-SALES-009/after-storage-snapshot-sanitized.json
outputs/V1-SALES-009/after-screenshot.png
outputs/V1-SALES-009/invoice-lifecycle-regression-summary.json
outputs/V1-SALES-009/verify-runtime.mjs
```

## Scope Confirmation

- No source fix was needed.
- No returns implementation.
- No partial returns.
- No invoice hard delete.
- No Product CRUD behavior changed.
- No Product records mutated.
- `Product.quantity` not updated.
- No Auth behavior changed.
- Route Guard not weakened.
- No localStorage migration.
- No Firebase UID or provider user id used as `accountId`.
- No default account fallback.
- `.env` remains untracked.
