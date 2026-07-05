# V1-SALES-012 Verification

## Mission

`V1-SALES-012 - Invoice Return Stock Restoration Execution`

## Classification

`ECS`

## Baseline

- Baseline tag:
  `v1-sales-011-account-scoped-invoice-returns-persistence-baseline`.
- Branch:
  `v1/sales-012-invoice-return-stock-restoration-execution`.
- Baseline runtime result: PASS.
- Baseline confirmed `invoiceReturns:{accountId}` could persist a valid return
  record while `returnStockMovementId` stayed empty and no `sale_return`
  movement was created.
- Baseline confirmed `invoices:{accountId}`,
  `stockMovements:{accountId}`, and `products:{accountId}` safety boundaries.

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
outputs/V1-SALES-012/baseline-runtime.json
outputs/V1-SALES-012/baseline-dom.json
outputs/V1-SALES-012/baseline-console.log
outputs/V1-SALES-012/baseline-storage-snapshot-sanitized.json
outputs/V1-SALES-012/baseline-screenshot.png
```

Baseline summary:

- AuthSession: PASS.
- Route Guard: PASS.
- Invoice route: PASS.
- `invoiceReturns:{accountId}` used: PASS.
- `stockMovements:{accountId}` used: PASS.
- No global `invoiceReturns` key: PASS.
- Return record created: PASS.
- `returnStockMovementId` empty before execution: PASS.
- Stock movement count unchanged: PASS.
- Invoice hash unchanged: PASS.
- Product hash unchanged: PASS.
- Console errors: 0.
- Page exceptions: 0.

## Implementation Verification

- TypeScript: PASS.
- Build: PASS.
- Runtime: PASS.

Commands:

```text
pnpm exec tsc --noEmit
pnpm run build
node outputs/V1-SALES-012/verify-runtime.mjs after
```

## After Evidence

```text
outputs/V1-SALES-012/after-runtime.json
outputs/V1-SALES-012/after-dom.json
outputs/V1-SALES-012/after-console.log
outputs/V1-SALES-012/after-storage-snapshot-sanitized.json
outputs/V1-SALES-012/after-screenshot.png
outputs/V1-SALES-012/invoice-return-execution-summary.json
```

After summary:

- Valid return executes: PASS.
- `sale_return` movement created: PASS.
- `sale_return.quantityDelta` positive: PASS.
- `sale_return.productId` matches return line: PASS.
- `sale_return.accountId` matches return record account: PASS.
- `sale_return.referenceType` is `invoice_return`: PASS.
- `sale_return` traces original `sale_deduction`: PASS.
- `returnStockMovementId` set: PASS.
- `returnStockMovementId` references created movement: PASS.
- Available quantity increased from `3` to `4`: PASS.
- Reload preserves `returnStockMovementId`: PASS.
- Reload preserves `sale_return`: PASS.
- Draft invoice return execution rejected: PASS.
- Cancelled invoice return execution rejected: PASS.
- Missing return rejected: PASS.
- Missing invoice rejected: PASS.
- Missing invoice line rejected: PASS.
- Zero/negative return quantity rejected: PASS.
- Over-return rejected: PASS.
- Duplicate execution rejected: PASS.
- Duplicate execution creates no duplicate `sale_return`: PASS.
- Original `sale_deduction` preserved: PASS.
- `invoices:{accountId}` hash unchanged: PASS.
- `products:{accountId}` hash unchanged: PASS.
- Legacy Product key unchanged/absent: PASS.
- No return UI: PASS.
- No return route: PASS.
- Console errors: 0.
- Page exceptions: 0.
- `.env` untracked: PASS.

## Tool Note

An initial after-runtime attempt produced application-success evidence but failed
one assertion because the verification script did not include `returnQuantity`
in the runtime summary. This was classified as a TOOL verification assertion
issue. The application source was not changed for that tool issue. The final
after-runtime package listed above is the accepted PASS evidence.

## Result

`V1-SALES-012 Runtime Verification PASS`
