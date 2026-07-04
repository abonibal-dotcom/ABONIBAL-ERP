# V1-SALES-002 Invoice Lifecycle Plan

## Classification

INF.

This file defines the planned V1 invoice lifecycle before source implementation begins.

## V1 Lifecycle States

Recommended V1-now states:

```text
draft
issued
cancelled
```

Deferred states:

```text
returned
partially_returned
voided
```

Returns, partial returns, and financial voiding require separate business rules and must not block the first account-scoped invoice persistence baseline.

## Draft

Meaning:

- Invoice is being prepared.
- Invoice may be edited.
- Invoice is stored in `invoices:{accountId}`.
- Invoice does not create stock movements.
- Invoice does not deduct stock.
- Invoice does not update `Product.quantity`.

Allowed behavior:

- Create draft.
- Update draft header.
- Update draft lines.
- Recalculate totals.
- Cancel draft non-destructively if cancellation is chosen as the first delete-safe policy.

Not allowed:

- Stock deduction.
- Product mutation.
- Global invoice storage.
- Cross-account read/write.

## Issued

Meaning:

- Invoice is finalized.
- Future issuing flow must pass Inventory availability checks before becoming issued.
- Future stock deduction must use `sale_deduction` movements with `referenceType = "invoice"` and `referenceId = invoice.id`.

Allowed behavior:

- Preserve original header and line history.
- Set `issuedAt` and `issuedBy`.
- Store final totals.
- Store stock movement references after the future deduction mission exists.

Restricted behavior:

- Editing issued line quantities should be blocked or handled by a later correction/reversal mission.
- Direct Product mutation is forbidden.
- Hard delete is forbidden.

## Cancelled

Meaning:

- Invoice is no longer active.
- Invoice record remains stored for auditability.
- Cancellation is non-destructive.

Allowed behavior:

- Set `cancelledAt`, `cancelledBy`, and `cancelReason`.
- Keep the same invoice id and invoice number.
- Preserve all lines and totals.

Future stock behavior:

- If an issued invoice already created stock deductions, cancellation must create reversal/return movements in a later mission.
- Cancellation must not delete original `sale_deduction` movements.
- Cancellation must not edit Product quantity.

## Delete Policy

Hard delete is not recommended for V1 invoice records.

Draft removal may be revisited later, but the safest V1 persistence baseline should preserve records and rely on lifecycle state. This avoids silent data loss and keeps invoice numbering auditable.

## Edit Policy

- Draft invoices are editable.
- Issued invoices are not freely editable.
- Cancelled invoices are not editable except for controlled metadata if later approved.

Any future correction flow should be an explicit mission and should preserve history instead of rewriting finalized records.

## Verification Expectations For Future Source Mission

The next persistence baseline should verify:

- Draft records persist under `invoices:{accountId}`.
- Issued records preserve account and ownership metadata.
- Cancelled records remain stored and are not hard-deleted.
- Cross-account access is rejected.
- Product records and stock movements remain unchanged unless a later issuing/deduction mission explicitly allows stock integration.

