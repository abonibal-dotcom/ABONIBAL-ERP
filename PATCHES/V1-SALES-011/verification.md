# V1-SALES-011 Verification

## Mission

`V1-SALES-011 - Account-Scoped Invoice Returns Persistence Baseline`

## Classification

ECS.

## Baseline Tag

`v1-sales-010-invoice-returns-partial-returns-design-plan`

## Verification Commands

```text
pnpm exec tsc --noEmit
pnpm run build
node outputs/V1-SALES-011/verify-runtime.mjs
```

## TypeScript Result

PASS.

## Build Result

PASS.

Build completed successfully. The Vite chunk-size warning is informational and
does not fail the build.

## Runtime Result

PASS.

Verification tool:

`Chrome DevTools Protocol direct WebSocket client`

Runtime profile:

Accepted `V1-SALES-009` after-runtime profile copy.

## Evidence Files

```text
outputs/V1-SALES-011/runtime.json
outputs/V1-SALES-011/dom.json
outputs/V1-SALES-011/console.log
outputs/V1-SALES-011/storage-snapshot-sanitized.json
outputs/V1-SALES-011/screenshot.png
outputs/V1-SALES-011/invoice-returns-persistence-summary.json
outputs/V1-SALES-011/verify-runtime.mjs
```

## Runtime Gates

| Gate | Result |
| --- | --- |
| AuthSession exists | PASS |
| AuthSession.accountId exists | PASS |
| accountId is not providerUserId | PASS |
| Route Guard remains active | PASS |
| `invoiceReturns:{accountId}` used | PASS |
| No global `invoiceReturns` key | PASS |
| First return record created | PASS |
| Partial return within remaining quantity accepted | PASS |
| Return record includes accountId | PASS |
| Return record includes createdBy | PASS |
| Return record references issued invoice | PASS |
| Return line references invoice line | PASS |
| Return line stores Product snapshot | PASS |
| `returnStockMovementId` remains empty/null | PASS |
| Original `sale_deduction` id is preserved on return line | PASS |
| `getAll()` returns created return | PASS |
| `getByInvoiceId()` returns created return | PASS |
| Reload preserves return records | PASS |
| Draft invoice return rejected | PASS |
| Cancelled invoice return rejected | PASS |
| Missing invoice rejected | PASS |
| Missing invoice line rejected | PASS |
| Zero quantity rejected | PASS |
| Negative quantity rejected | PASS |
| Over-return rejected | PASS |
| Duplicate excessive return rejected | PASS |
| Duplicate line in one request rejected | PASS |
| Remaining returnable quantity computed correctly | PASS |
| `invoices:{accountId}` unchanged | PASS |
| `stockMovements:{accountId}` unchanged | PASS |
| No `sale_return` movement created | PASS |
| Product scoped storage unchanged | PASS |
| Legacy Product key unchanged/absent | PASS |
| No return UI | PASS |
| No return route | PASS |
| Console errors = 0 | PASS |
| Page exceptions = 0 | PASS |
| `.env` untracked | PASS |

## Runtime Metrics

```text
invoiceReturns scoped key: invoiceReturns:{sanitized accountId}
return count before: 0
return count after: 2
return count after reload: 2
remaining returnable quantity before: 2
remaining returnable quantity after: 0
invoice hash before/after: unchanged
stock movement count before/after: 2 / 2
stock movement hash before/after: unchanged
product scoped hash before/after: unchanged
legacy Product hash before/after: unchanged/absent
console errors: 0
page exceptions: 0
```

## Cancelled Invoice Rejection Note

The accepted runtime profile did not contain a stored cancelled invoice suitable
for a destructive storage-backed rejection test. To preserve the mission rule
that `invoices:{accountId}` must not be mutated, cancelled-invoice rejection was
verified through the runtime service boundary with an in-memory cancelled
invoice dependency. No invoice storage write was performed for this check.

## Safety Confirmation

- No return UI added.
- No return route added.
- No stock restoration implemented.
- No `sale_return` movement created for returns.
- No invoice mutation.
- No stock movement mutation.
- No Product mutation.
- `Product.quantity` not updated.
- No invoice status changed to `partially_returned` or `returned`.
- No Auth behavior change.
- Route Guard remains active.
- No Firebase UID or provider user id used as `accountId`.
- No default account fallback.
- `.env` remains untracked.
