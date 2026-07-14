# Draft Invoice Delete Fix

## Root cause

Draft rows exposed edit and issue actions only. The account-scoped invoice
service had no delete operation constrained to draft status.

## Fix

- `InvoiceRepository.removeForAccount` removes only a matching record from the
  current account storage key.
- `InvoiceService.deleteDraft` requires an authenticated account, requires the
  invoice to exist in that account, and rejects every non-draft status.
- The invoice page shows `حذف المسودة` only for draft invoices and requires a
  confirmation before calling the service.
- A successful deletion refreshes the list immediately and does not create or
  reverse a stock movement.

## Required owner Preview retest

1. Create a draft invoice and confirm the delete action is visible.
2. Cancel the confirmation and confirm the draft remains.
3. Confirm deletion, reload, and confirm the draft does not return.
4. Confirm issued, cancelled, returned, and other non-draft invoices do not
   expose this action.
5. Confirm a direct service attempt against a non-draft is rejected.

## Validation

- TypeScript: PASS
- Production touched: NO
- TEST live deployment: NO
- Browser interaction validation: pending owner Preview retest.
