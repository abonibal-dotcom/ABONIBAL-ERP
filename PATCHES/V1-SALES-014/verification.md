# V1-SALES-014 Verification

## Mission

`V1-SALES-014 - Sales Lifecycle Regression Including Returns`

## Classification

`ECS`

## Baseline

- Baseline tag: `v1-sales-013-invoice-returns-ui-flow`.
- Branch: `v1/sales-014-sales-lifecycle-regression-including-returns`.
- Baseline runtime result: PASS.
- Baseline was read-only and confirmed protected Invoice route, AuthSession,
  explicit `accountId`, Route Guard, Products route, Inventory route, Invoice
  route, issued invoice audit visibility, return UI availability from
  V1-SALES-013, scoped storage keys, clean console, zero page exceptions, and
  `.env` untracked.

## Runtime Environment

- Runtime: Vite dev server on `127.0.0.1:62006`.
- Browser: local Chrome / Edge through CDP.
- Verification tool: direct Chrome DevTools Protocol script.
- Reason for selection: stable deterministic DOM, storage, screenshot, console,
  and page-exception evidence without adding test dependencies.
- Known limitation: verification script failures are classified as TOOL failures
  unless runtime evidence proves application failure.

## Baseline Evidence

```text
outputs/V1-SALES-014/baseline-runtime.json
outputs/V1-SALES-014/baseline-dom.json
outputs/V1-SALES-014/baseline-console.log
outputs/V1-SALES-014/baseline-storage-snapshot-sanitized.json
outputs/V1-SALES-014/baseline-screenshot.png
```

## Verification Commands

```text
pnpm exec tsc --noEmit
pnpm run build
node outputs/V1-SALES-014/verify-runtime.mjs after
```

## Verification Result

- TypeScript: PASS.
- Build: PASS.
- Runtime: PASS.
- Console errors: 0.
- Page exceptions: 0.

## After Evidence

```text
outputs/V1-SALES-014/after-runtime.json
outputs/V1-SALES-014/after-dom.json
outputs/V1-SALES-014/after-console.log
outputs/V1-SALES-014/after-storage-snapshot-sanitized.json
outputs/V1-SALES-014/after-screenshot.png
outputs/V1-SALES-014/sales-lifecycle-returns-regression-summary.json
outputs/V1-SALES-014/verify-runtime.mjs
```

## Runtime Summary

- Invoice route protected: PASS.
- Draft create/update: PASS.
- Failed issue blocked: PASS.
- Successful issue and `sale_deduction`: PASS.
- Issued audit view: PASS.
- Duplicate issue safety: PASS.
- Issued cancellation: PASS.
- Cancellation `sale_return` reversal: PASS.
- Duplicate cancellation safety: PASS.
- Return UI for issued invoice: PASS.
- Return UI hidden for draft/cancelled invoices: PASS.
- Invalid return quantity rejected: PASS.
- Over-return rejected: PASS.
- Duplicate excessive return rejected: PASS.
- Valid partial return creates `invoiceReturns:{accountId}` record: PASS.
- Valid partial return executes stock restoration: PASS.
- Return `sale_return` movement created: PASS.
- `returnStockMovementId` set and references created movement: PASS.
- Remaining returnable quantity decreased from `2` to `1`: PASS.
- Availability changed from `4` before issue, to `2` after issue, to `4`
  after cancellation, to `3` after return, and remained `3` after reload.
- Reload preserves draft, issued, cancelled, invoice return record,
  `sale_deduction`, cancellation `sale_return`, return `sale_return`, and audit
  traceability: PASS.
- Product scoped hash unchanged: PASS.
- Legacy Product key unchanged/absent: PASS.
- No Product CRUD behavior changed: PASS.
- No invoice hard delete: PASS.
- `.env` untracked: PASS.

## Result

`V1-SALES-014 Runtime Verification PASS`
