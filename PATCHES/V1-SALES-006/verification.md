# V1-SALES-006 Verification

## Mission

`V1-SALES-006 - Issued Invoice Read / Stock Deduction Audit View`

## Classification

ECS.

## Branch

`v1/sales-006-issued-invoice-read-stock-deduction-audit-view`

## Baseline Tag

`v1-sales-005-invoice-issue-stock-deduction-flow`

## Pre-check Result

- Working directory: `C:\Users\aboni\Documents\Codex\2026-06-26\abonibal-dotcom-abonibal-erp-https-github-3\work\ABONIBAL-ERP`
- Branch: `v1/sales-006-issued-invoice-read-stock-deduction-audit-view`
- Baseline tag exists: yes.
- `.env` tracked by Git: no.
- Product regression accepted: yes, ECS-011.
- Inventory availability gate accepted: yes, V1-INV-007.
- Invoice issue flow accepted: yes, V1-SALES-005.
- Cancellation remains blocked: yes.
- Returns remain blocked: yes.
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
- `PATCHES/V1-SALES-003/closure-report.md`
- `PATCHES/V1-SALES-004/closure-report.md`
- `PATCHES/V1-SALES-005/verification.md`
- `PATCHES/V1-SALES-005/closure-report.md`

## Source Inspection Result

```text
invoice list exists: yes
invoice detail view exists: no
issued invoice status display exists: yes
invoice line snapshot display exists: no
stockMovementId display exists: no
sale_deduction lookup available: yes, read-only through InventoryService.getAll()
issued invoice edit blocked: yes
cancellation UI exists: no
```

## Baseline Runtime

Baseline evidence was captured before source changes.

The first baseline attempt failed before evidence completion because the CDP reload invocation lost the inspected target. It was classified as TOOL evidence collection failure, not application failure. The verifier was adjusted to reload through `Page.navigate`, then a new complete baseline was captured.

Files:

- `outputs/V1-SALES-006/baseline-runtime.json`
- `outputs/V1-SALES-006/baseline-dom.json`
- `outputs/V1-SALES-006/baseline-console.log`
- `outputs/V1-SALES-006/baseline-storage-snapshot-sanitized.json`
- `outputs/V1-SALES-006/baseline-screenshot.png`

Baseline result: PASS.

Baseline confirmed:

- Unauthenticated invoice route access is blocked.
- Login succeeds.
- AuthSession.accountId exists.
- Route Guard remains active.
- Draft flow works.
- Issue flow works.
- Issued invoice is visible after reload.
- Issued status is displayed.
- `invoices:{accountId}` key is inspected.
- `stockMovements:{accountId}` count/hash is recorded.
- `products:{accountId}` hash is recorded.
- `stockMovementId` is not visible in the UI before this mission.
- Invoice line audit rows are missing before this mission.
- Cancellation UI is absent.
- Console errors: 0.
- Page exceptions: 0.

## Implementation Scope

Implemented minimal read-only issued invoice audit visibility in `src/modules/sales/pages/InvoiceDraftPage.ts` only.

The page now displays:

- Invoice number.
- Invoice status.
- Invoice total.
- Created timestamp.
- Issued timestamp.
- Invoice line Product snapshot.
- Line quantity.
- Line unit price.
- Line total.
- Line `stockMovementId` / deduction reference.

No cancellation, returns, reversal movement, Product CRUD, Product mutation, Product quantity update, Inventory manual adjustment change, Auth change, Route Guard weakening, or localStorage migration was added.

## Verification Commands

```text
pnpm exec tsc --noEmit
pnpm run build
node outputs/V1-SALES-006/verify-runtime.mjs after
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
Known Limitations: Uses approved local Firebase test credentials through local environment without printing secrets. A disposable browser profile uses controlled fixture Product and opening balance records to verify issue/audit behavior, then checks Product and legacy storage safety.
```

## Runtime Evidence

Files:

- `outputs/V1-SALES-006/after-runtime.json`
- `outputs/V1-SALES-006/after-dom.json`
- `outputs/V1-SALES-006/after-console.log`
- `outputs/V1-SALES-006/after-storage-snapshot-sanitized.json`
- `outputs/V1-SALES-006/after-screenshot.png`
- `outputs/V1-SALES-006/issued-invoice-audit-summary.json`

Runtime result: PASS.

## Runtime Result

PASS.

Key results:

- Unauthenticated invoice route redirects/blocks to Login: PASS.
- Login succeeds: PASS.
- AuthSession exists and has explicit accountId: PASS.
- accountId is not Firebase UID/provider user id: PASS.
- Invoice route is accessible after login: PASS.
- Route Guard remains active: PASS.
- Issued invoice appears after reload: PASS.
- Issued status is displayed: PASS.
- Invoice number is displayed: PASS.
- Invoice total is displayed: PASS.
- Invoice issuedAt is displayed: PASS.
- Invoice line Product snapshot is displayed: PASS.
- Invoice line quantity, unit price, and line total are displayed: PASS.
- `stockMovementId` is visible in the read-only audit row: PASS.
- Referenced stock movement exists: PASS.
- Referenced movement type is `sale_deduction`: PASS.
- Referenced movement `quantityDelta` is negative: PASS.
- Referenced movement productId matches invoice line productId: PASS.
- Referenced movement accountId matches invoice accountId: PASS.
- Available stock remains reduced after reload: PASS.
- Issued invoice is not editable as draft: PASS.
- Re-clicking issue does not create duplicate `sale_deduction`: PASS.
- No cancellation UI/action is available: PASS.
- No reversal movement is created: PASS.
- Product records remain unchanged: PASS.
- `Product.quantity` remains unchanged and non-authoritative: PASS.
- Console errors: 0.
- Page exceptions: 0.
- `.env` remains untracked: PASS.

## Evidence Summary

```text
sanitized accountId: recorded
invoice scoped key: invoices:{sanitized-accountId}
stock movement scoped key: stockMovements:{sanitized-accountId}
issued invoice id: recorded
invoice status displayed: true
invoice number displayed: true
invoice total displayed: true
invoice issuedAt displayed: true
invoice line Product snapshot displayed: true
stockMovementId result: visible and matches referenced movement
referenced movement type: sale_deduction
referenced movement quantityDelta: -2
available quantity after reload: 3
duplicate issue movement count result: unchanged
Product scoped key hash before/after: unchanged
legacy Product key hash before/after: null / null
console errors count: 0
page exceptions count: 0
```

## Scope Safety

- No invoice cancellation implemented.
- No invoice return implemented.
- No invoice hard delete implemented.
- No reversal movement created.
- No Product CRUD behavior changed.
- Product records were not mutated by invoice read/audit display.
- `Product.quantity` was not updated.
- Product quantity was not made authoritative.
- Inventory manual adjustment behavior was not changed.
- Route Guard was not weakened.
- Auth behavior was not changed.
- No localStorage migration was added.
- No Firebase UID/provider user id was used as `accountId`.
- No default account fallback was added.
- `.env` remains untracked.
