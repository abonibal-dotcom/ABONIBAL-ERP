# V1-SALES-005 Verification

## Mission

`V1-SALES-005 - Invoice Issue / Stock Deduction Flow`

## Classification

ECS.

## Branch

`v1/sales-005-invoice-issue-stock-deduction-flow`

## Baseline Tag

`v1-sales-004-invoice-draft-create-update-flow`

## Pre-check Result

- Current working directory: `C:\Users\aboni\Documents\Codex\2026-06-26\abonibal-dotcom-abonibal-erp-https-github-3\work\ABONIBAL-ERP`
- Current branch: `v1/sales-005-invoice-issue-stock-deduction-flow`
- Baseline tag exists: yes.
- `.env` tracked by Git: no.
- Product regression accepted: yes, ECS-011.
- Inventory availability gate accepted: yes, V1-INV-007.
- Invoice draft flow accepted: yes, V1-SALES-004.
- Cancellation remains blocked: yes.
- Tracked working tree before source changes: clean.

## Documents Reviewed

- `ENGINEERING_CONSTITUTION.md`
- `PROJECT_ORIENTATION.md`
- `PROJECT_STATUS.md`
- `CURRENT_MISSION.md`
- `ROADMAP.md`
- `CHANGELOG.md`
- `DECISIONS.md`
- `PATCHES/ECS-011/closure-report.md`
- `PATCHES/V1-INV-007/closure-report.md`
- `PATCHES/V1-SALES-002/invoice-stock-integration-plan.md`
- `PATCHES/V1-SALES-003/closure-report.md`
- `PATCHES/V1-SALES-004/verification.md`
- `PATCHES/V1-SALES-004/closure-report.md`

## Source Inspection Result

Before implementation:

```text
issue method exists: yes, status-only markIssued
markIssued exists: yes
invoice line stockMovementId exists: yes
sale_deduction movement type exists: yes
stock availability gate available: yes
invoice route protected: yes
draft UI exists: yes
cancellation UI exists: no
```

Key finding:

`InvoiceService.markIssued()` changed invoice status to `issued`, but did not call the Inventory availability gate, did not create `sale_deduction` movements, and did not attach `stockMovementId` to invoice lines.

## Baseline Runtime

Baseline evidence was captured before source changes.

Files:

- `outputs/V1-SALES-005/baseline-runtime.json`
- `outputs/V1-SALES-005/baseline-dom.json`
- `outputs/V1-SALES-005/baseline-console.log`
- `outputs/V1-SALES-005/baseline-storage-snapshot-sanitized.json`
- `outputs/V1-SALES-005/baseline-screenshot.png`

Baseline result: PASS.

Baseline confirmed:

- Unauthenticated invoice route access is blocked.
- Login succeeds.
- AuthSession.accountId exists.
- Route Guard remains active.
- Invoice draft UI works.
- Product selector uses active Products.
- Inventory availability gate reports stock.
- `invoices:{accountId}` key is inspected.
- `stockMovements:{accountId}` count/hash is recorded.
- `products:{accountId}` hash is recorded.
- Issue action is missing before this mission.
- No `sale_deduction` movement exists before this mission.
- Console errors: 0.
- Page exceptions: 0.

## Implementation Scope

Implemented minimal invoice issue and stock deduction flow:

- `InvoiceService.markIssued()` now checks Inventory availability before issuing.
- Insufficient stock blocks issue and leaves invoice as `draft`.
- Successful issue creates one `sale_deduction` stock movement per invoice line.
- Created movement uses negative `quantityDelta`.
- Movement uses `referenceType = "invoice"` and `referenceId = invoice.id`.
- Invoice line receives the created movement id as `stockMovementId`.
- Invoice is marked `issued` only after movement creation succeeds.
- Draft page shows an `Issue` action only for draft invoices.
- Issued invoices are no longer editable through the draft update UI.

No cancellation, return, Product CRUD, Product mutation, Product quantity update, Inventory manual adjustment change, Auth change, Route Guard weakening, or localStorage migration was added.

## Verification Commands

```text
pnpm exec tsc --noEmit
pnpm run build
node outputs/V1-SALES-005/verify-runtime.mjs after
```

## TypeScript Result

PASS.

## Build Result

PASS.

## Runtime Verification Environment

```text
Runtime: Vite dev server on 127.0.0.1
Browser: Local Chrome / Edge via CDP
Verification Tool: Direct CDP WebSocket runtime script
Reason for Selection: Existing project runtime evidence pattern; stable DOM, Auth, Container service, localStorage, and screenshot inspection without app-only test hooks
Known Limitations: Uses approved local Firebase test credentials through local environment without printing secrets. A disposable browser profile uses controlled fixture Product and opening balance records to verify issue behavior, then checks Product and legacy storage safety.
```

## Runtime Evidence

Files:

- `outputs/V1-SALES-005/after-runtime.json`
- `outputs/V1-SALES-005/after-dom.json`
- `outputs/V1-SALES-005/after-console.log`
- `outputs/V1-SALES-005/after-storage-snapshot-sanitized.json`
- `outputs/V1-SALES-005/after-screenshot.png`
- `outputs/V1-SALES-005/invoice-issue-summary.json`

Runtime result: PASS.

## Runtime Result

PASS.

Key results:

- Unauthenticated invoice route access redirects to Login: PASS.
- Login succeeds: PASS.
- AuthSession exists: PASS.
- AuthSession.accountId exists: PASS.
- accountId is not Firebase UID/provider user id: PASS.
- Invoice route is accessible after login: PASS.
- Route Guard remains active: PASS.
- Failed issue with insufficient stock is blocked: PASS.
- Failed issue invoice remains `draft`: PASS.
- Failed issue creates no `sale_deduction`: PASS.
- Failed issue movement count remains unchanged: PASS.
- Successful issue changes invoice status to `issued`: PASS.
- `issuedAt` is set: PASS.
- Invoice id remains unchanged: PASS.
- Invoice accountId remains unchanged: PASS.
- `sale_deduction` movement is created: PASS.
- `sale_deduction.quantityDelta` is negative: PASS.
- `sale_deduction.productId` matches invoice line Product id: PASS.
- Invoice line `stockMovementId` is set: PASS.
- `stockMovementId` references the created movement: PASS.
- Available stock decreases from 5 to 3: PASS.
- Product quantity remains unchanged: PASS.
- Product records remain unchanged: PASS.
- Duplicate issue attempt creates no duplicate movement: PASS.
- Issued invoice remains issued after duplicate attempt: PASS.
- Reload preserves issued invoice: PASS.
- Reload preserves stock movement: PASS.
- Reload preserves decreased availability: PASS.
- No cancellation action is available: PASS.
- Console errors: 0.
- Page exceptions: 0.
- `.env` remains untracked: PASS.

## Evidence Summary

```text
sanitized accountId: recorded in outputs/V1-SALES-005/invoice-issue-summary.json
invoice scoped key: invoices:{sanitized-accountId}
stock movement scoped key: stockMovements:{sanitized-accountId}
failed issue invoice id: recorded
failed issue result: blocked
successful issue invoice id: recorded
sale_deduction movement id: recorded
invoice line stockMovementId result: PASS
available quantity before issue: 5
available quantity after issue: 3
movement count before failed issue: 1
movement count after failed issue: 1
movement count after successful issue: 2
movement count after duplicate issue attempt: 2
Product scoped key hash before/after: unchanged
legacy Product key hash before/after: null / null
console errors count: 0
page exceptions count: 0
```

## Scope Safety

- No invoice cancellation implemented.
- No invoice return implemented.
- No invoice hard delete implemented.
- No Product CRUD behavior changed.
- Product records were not mutated by invoice issue.
- `Product.quantity` was not updated.
- Product quantity was not made authoritative.
- Inventory manual adjustment behavior was not changed.
- Route Guard was not weakened.
- Auth behavior was not changed.
- No localStorage migration was added.
- No Firebase UID/provider user id was used as `accountId`.
- No default account fallback was added.
- `.env` remains untracked.
