# V1-SALES-004 Closure Report

## Classification

ECS.

## Branch

`v1/sales-004-invoice-draft-create-update-flow`

## Baseline Tag

`v1-sales-003-account-scoped-invoice-persistence-baseline`

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

## Source Files Inspected

- `src/modules/sales/Invoice.ts`
- `src/modules/sales/InvoiceStatus.ts`
- `src/modules/sales/persistence/InvoicePersistenceKey.ts`
- `src/modules/sales/repositories/InvoiceRepository.ts`
- `src/modules/sales/validators/InvoiceValidator.ts`
- `src/modules/sales/services/InvoiceService.ts`
- `src/core/Container.ts`
- `src/router/routes.ts`
- `src/ui/navigation/Sidebar.ts`
- `src/modules/products/Product.ts`
- `src/modules/products/services/ProductService.ts`
- `src/modules/inventory/services/InventoryService.ts`
- `src/modules/auth/AuthSession.ts`
- `src/modules/auth/AuthState.ts`
- `src/modules/auth/AuthRuntime.ts`
- `src/modules/auth/AuthRouteGuard.ts`

## Files Changed

Source:

- `src/modules/sales/pages/InvoiceDraftPage.ts`
- `src/router/routes.ts`

Documentation:

- `PATCHES/V1-SALES-004/verification.md`
- `PATCHES/V1-SALES-004/closure-report.md`
- `CURRENT_MISSION.md`
- `PROJECT_STATUS.md`
- `CHANGELOG.md`
- `ROADMAP.md`

Evidence:

- `outputs/V1-SALES-004/baseline-runtime.json`
- `outputs/V1-SALES-004/baseline-dom.json`
- `outputs/V1-SALES-004/baseline-console.log`
- `outputs/V1-SALES-004/baseline-storage-snapshot-sanitized.json`
- `outputs/V1-SALES-004/baseline-screenshot.png`
- `outputs/V1-SALES-004/after-runtime.json`
- `outputs/V1-SALES-004/after-dom.json`
- `outputs/V1-SALES-004/after-console.log`
- `outputs/V1-SALES-004/after-storage-snapshot-sanitized.json`
- `outputs/V1-SALES-004/after-screenshot.png`
- `outputs/V1-SALES-004/invoice-draft-flow-summary.json`
- `outputs/V1-SALES-004/verify-runtime.mjs`

## Invoice Route Summary

Added protected route:

```text
invoices
```

Unauthenticated access redirects to Login.

Authenticated access opens the invoice draft page.

## Invoice Draft UI Summary

Added minimal draft UI only:

- Customer name.
- Product selector.
- Quantity.
- Unit price.
- Discount.
- Tax.
- Notes.
- Draft save.
- Draft list.
- Edit existing draft.

No issue or cancel controls are exposed.

## Product Selector Summary

The selector reads from `ProductService.getAll()` and filters selectable Products to active Products.

Soft-deleted Products are not selectable.

The invoice line stores Product id and Product snapshot fields.

## Invoice Storage Key Used

```text
invoices:{accountId}
```

No global `invoices` key is used.

## Draft Create Result

PASS.

Valid draft create writes one invoice to `invoices:{accountId}` with draft status, account id, creator id, line Product snapshot data, and computed totals.

Invalid draft submission writes no invoice.

## Draft Update Result

PASS.

Existing draft can be edited through the draft list.

Update preserves invoice id and accountId, keeps status `draft`, and persists updated line/totals.

## Invoice Line Snapshot Result

PASS.

The persisted line includes Product id and Product name snapshot. It does not depend on later Product mutation.

## Totals Result

PASS.

Runtime verified:

```text
created subtotal: 50
created discount: 1.5
created tax: 0.5
created total: 49
updated subtotal: 75
updated discount: 1.5
updated tax: 0.5
updated total: 74
```

## Reload Persistence Result

PASS.

Reload preserves the draft invoice and the draft list shows the saved draft.

## Product Safety Result

PASS.

- Product scoped hash remained unchanged during invoice create/update.
- Product quantity remained unchanged.
- Legacy Product key remained unchanged if present.
- No Product CRUD behavior changed.

## Inventory Safety Result

PASS.

- Stock movement count remained 0.
- Stock movement hash remained unchanged.
- No `sale_deduction` movement was created.
- No stock deduction was implemented.

## Route Guard Result

PASS.

- Invoice route is protected.
- Dashboard, Products, Inventory, and Invoices remain protected routes.
- Login remains public.
- Route Guard was not weakened.

## TypeScript Result

PASS.

## Build Result

PASS.

## Runtime Result

PASS.

## Console Errors Count

0.

## Page Exceptions Count

0.

## Confirmation No Invoice Issue Behavior

Confirmed.

No issue action exists in the invoice draft UI.

## Confirmation No Stock Deduction

Confirmed.

No stock movement is created and no `sale_deduction` exists.

## Confirmation No Firebase UID As AccountId

Confirmed.

Runtime verified `accountId` is explicit and distinct from Firebase UID/provider user id.

## Confirmation No Default Account Fallback

Confirmed.

The flow uses the authenticated `AuthSession.account.id` boundary.

## Confirmation .env Untracked

Confirmed.

`.env` remains untracked by Git.

## Commit Hash

Pending until commit.

## Tag Name

`v1-sales-004-invoice-draft-create-update-flow`

## Push Result

Pending until push.

## Final Git Status

Pending until commit and push.

## Recommended Next Mission

Owner-approved invoice issue / stock deduction planning or implementation gate, after review of V1-SALES-004.

Do not start the next mission in this closure.
