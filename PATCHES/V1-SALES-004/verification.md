# V1-SALES-004 Verification

## Mission

`V1-SALES-004 - Invoice Draft Create / Update Flow`

## Classification

ECS.

## Branch

`v1/sales-004-invoice-draft-create-update-flow`

## Baseline Tag

`v1-sales-003-account-scoped-invoice-persistence-baseline`

## Pre-check Result

- Current working directory: `C:\Users\aboni\Documents\Codex\2026-06-26\abonibal-dotcom-abonibal-erp-https-github-3\work\ABONIBAL-ERP`
- Current branch: `v1/sales-004-invoice-draft-create-update-flow`
- Baseline tag exists: yes.
- `.env` tracked by Git: no.
- Product regression accepted: yes, ECS-011.
- Inventory availability gate accepted: yes, V1-INV-007.
- Invoice persistence baseline accepted: yes, V1-SALES-003.
- Invoice issuing remains blocked: yes.
- Stock deduction remains blocked: yes.
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
- `PATCHES/V1-SALES-002/closure-report.md`
- `PATCHES/V1-SALES-003/verification.md`
- `PATCHES/V1-SALES-003/closure-report.md`

## Source Inspection Result

Before implementation:

```text
invoice route exists: no
invoice draft page exists: no
invoice service available in container: yes
createDraft available: yes
updateDraft available: yes
ProductService active products available: yes
Inventory availability gate available: yes
```

Inspected source:

- Sales / Invoice model, status, persistence key, repository, validator, and service.
- Container wiring.
- Route registry and Sidebar navigation.
- Product model and service.
- Inventory service and availability gate.
- AuthSession / AuthState / AuthRuntime / AuthRouteGuard.
- App bootstrap and route runtime behavior.

## Baseline Runtime

Baseline evidence was captured before source changes.

Files:

- `outputs/V1-SALES-004/baseline-runtime.json`
- `outputs/V1-SALES-004/baseline-dom.json`
- `outputs/V1-SALES-004/baseline-console.log`
- `outputs/V1-SALES-004/baseline-storage-snapshot-sanitized.json`
- `outputs/V1-SALES-004/baseline-screenshot.png`

Baseline result: PASS.

Baseline confirmed:

- Login succeeds.
- AuthSession.accountId exists.
- Route Guard remains active.
- Products route works.
- Inventory route works.
- Invoice service can read.
- No invoice route existed before implementation.
- No invoice draft UI existed before implementation.
- `invoices:{accountId}` was inspected.
- Product hash was recorded.
- Stock movement count/hash was recorded.
- Legacy Product hash was recorded if present.
- Console errors: 0.
- Page exceptions: 0.

Invalid Baseline Attempt:

- One earlier tool attempt waited for an obsolete Products selector.
- It failed before a valid baseline package was accepted.
- It was classified as verification-script adjustment, not application failure.
- The accepted Baseline is only the PASS package listed above.

## Implementation Scope

Added the minimal authenticated invoice draft create/update flow:

- Protected `invoices` route.
- Sidebar entry for `Invoices`.
- Minimal `InvoiceDraftPage`.
- Active Product selector using `ProductService.getAll()`.
- Draft form with customer name, product, quantity, unit price, discount, tax, and notes.
- Invalid draft submission rejection before write.
- Valid draft create through `InvoiceService.createDraft`.
- Existing draft edit/update through `InvoiceService.updateDraft`.
- Totals preview and persisted totals.
- Reload-visible draft list.

No invoice issuing, cancellation UI, stock deduction, `sale_deduction`, Product mutation, Inventory mutation, Auth changes, or localStorage migration was added.

## Verification Commands

```text
pnpm exec tsc --noEmit
pnpm run build
node outputs/V1-SALES-004/verify-runtime.mjs after
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
Known Limitations: Uses approved local Firebase test credentials through local environment without printing secrets. A disposable browser profile uses controlled fixture Product records to test Product selection, then verifies the invoice flow does not mutate Product or Inventory state.
```

## Runtime Evidence

Files:

- `outputs/V1-SALES-004/after-runtime.json`
- `outputs/V1-SALES-004/after-dom.json`
- `outputs/V1-SALES-004/after-console.log`
- `outputs/V1-SALES-004/after-storage-snapshot-sanitized.json`
- `outputs/V1-SALES-004/after-screenshot.png`
- `outputs/V1-SALES-004/invoice-draft-flow-summary.json`

Runtime result: PASS.

Invalid After Attempt:

- One after-runtime attempt reached evidence collection and exposed a draft update totals mismatch.
- Classification: ECS, inside the invoice draft page input mapping.
- Root cause: update flow sent line discount/tax but left invoice-level discount/tax undefined, causing the service to preserve previous aggregate values.
- Minimal fix: `InvoiceDraftPage` now sends invoice-level `discount: 0` and `tax: 0` while preserving line-level discount/tax.

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
- Invoice draft UI renders: PASS.
- Active Product selector works: PASS.
- Soft-deleted Products are not selectable: PASS.
- Invalid draft submission does not write invoice: PASS.
- Valid draft create writes one invoice to `invoices:{accountId}`: PASS.
- Created invoice status is `draft`: PASS.
- Created invoice includes `accountId` and `createdBy`: PASS.
- Created invoice line includes Product id and Product name snapshot: PASS.
- Totals are computed and stored: PASS.
- Existing draft can be updated: PASS.
- Updated draft keeps same id and accountId: PASS.
- Updated draft remains `draft`: PASS.
- Updated line/totals are persisted: PASS.
- Reload preserves draft invoice: PASS.
- No issue action available: PASS.
- No cancel action available: PASS.
- No `sale_deduction` movement created: PASS.
- `stockMovements:{accountId}` count/hash unchanged: PASS.
- `products:{accountId}` hash unchanged during invoice flow: PASS.
- `Product.quantity` not updated: PASS.
- Legacy `localStorage.products` unchanged if present: PASS.
- Console errors: 0.
- Page exceptions: 0.
- `.env` remains untracked: PASS.

## Evidence Summary

```text
sanitized accountId: recorded in outputs/V1-SALES-004/invoice-draft-flow-summary.json
invoice scoped key: invoices:{sanitized-accountId}
invoice count before create: 0
invoice count after invalid create: 0
invoice count after valid create: 1
created invoice status: draft
created invoice line Product snapshot: PASS
draft update result: PASS
created totals: subtotal 50, discount 1.5, tax 0.5, total 49
updated totals: subtotal 75, discount 1.5, tax 0.5, total 74
reload persistence: PASS
stock movement count after flow: 0
sale_deduction count: 0
console errors count: 0
page exceptions count: 0
```

## Scope Safety

- No invoice issuing implemented.
- No invoice cancellation UI implemented.
- No invoice stock deduction implemented.
- No `sale_deduction` movements created.
- No Product records mutated by invoice create/update.
- `Product.quantity` not updated.
- No Product CRUD behavior changed.
- No Inventory behavior changed.
- No Auth behavior changed.
- Route Guard not weakened.
- No localStorage migration.
- No Firebase UID/provider user id used as `accountId`.
- No default account fallback added.
- `.env` remains untracked.
