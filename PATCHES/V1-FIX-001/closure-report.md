# V1-FIX-001 Closure Report

## Classification

BUGFIX / Preview Blocking Runtime Fix

## Root causes and resolution

1. Product creation did not collect the default sale price or establish opening
   stock through the inventory ledger. The dialog, factory, validation, product
   list, and a narrow InventoryService helper now address that path.
2. Draft invoices could not be deleted because no draft-only service operation
   or UI action existed. Account-scoped draft deletion is now explicit.
3. Ledger draft validation was silent and ambiguous in the UI. The page now
   clears conflicting amounts, excludes fully empty rows safely, and explains
   each blocking validation state.

## Files changed

- `src/modules/products/dto/ProductData.ts`
- `src/modules/products/dialogs/ProductDialog.ts`
- `src/modules/products/dialogs/tabs/GeneralTab.ts`
- `src/modules/products/factories/ProductFactory.ts`
- `src/modules/products/pages/ProductListPage.ts`
- `src/modules/products/services/ProductService.ts`
- `src/modules/products/validators/ProductValidator.ts`
- `src/modules/inventory/services/InventoryService.ts`
- `src/modules/sales/repositories/InvoiceRepository.ts`
- `src/modules/sales/services/InvoiceService.ts`
- `src/modules/sales/pages/InvoiceDraftPage.ts`
- `src/modules/ledger/pages/LedgerManagementPage.ts`
- `PATCHES/V1-FIX-001/*`

## Results

- Product price: persisted through the existing `salePrice` domain field.
- Opening stock: positive new-product quantity creates one account-scoped,
  idempotent opening movement; the visible quantity is ledger-derived.
- Draft invoice deletion: draft-only, account-scoped, confirmed in UI, and does
  not create a stock reversal.
- Ledger save: valid balanced posting-account lines can be submitted; invalid
  rows now receive visible feedback before service submission.
- TypeScript: PASS
- Build: PASS
- `git diff --check`: PASS
- Console/Page/Network: pending owner Preview retest because no controllable
  authenticated browser session is available.
- Production touched: NO
- TEST live deployment: NO
- Push: NOT PERFORMED

## Scope confirmation

No Firebase rules or Auth changes, source-of-truth redesign, Payment/Cash/Ledger
auto-posting, production deployment, or TEST live deployment was performed.

## Final result

READY FOR OWNER PREVIEW RETEST
