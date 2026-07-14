# Product Price and Opening Stock Fix

## Root cause

The Product dialog collected identity fields only. The Product factory therefore
always created `salePrice` as zero, and the Products table read legacy
`Product.quantity` instead of the stock-movement ledger.

## Fix

- The dialog now collects the default sale price and validates it as a finite,
  non-negative value through `ProductValidator`.
- Older records without a price are read with a compatibility default of zero.
- New-product creation accepts a non-negative opening quantity. A positive
  value appends an `opening_balance` StockMovement with the authenticated
  account context and a product-create reference.
- The opening movement is idempotent for the product-create reference. If
  movement creation fails, the new product is safe-deleted and the UI reports
  the controlled rollback instead of leaving a visible partial record.
- Edit mode exposes current quantity as a read-only value derived from the
  StockMovement ledger. It never writes `Product.quantity`.
- Product list quantity is now derived through `InventoryService`.

## Required owner Preview retest

1. Create `TESTDEPLOY-001-QA-Product` with sale price `25` and opening quantity
   `10`.
2. Confirm list price `25` and derived inventory quantity `10` after reload.
3. Edit only the sale price to `30`; confirm the derived quantity remains `10`.
4. Confirm one opening movement only and that Product.quantity is not used as
   the inventory source of truth.

## Validation

- TypeScript: PASS
- Production touched: NO
- TEST live deployment: NO
- Browser interaction validation: pending owner Preview retest.
