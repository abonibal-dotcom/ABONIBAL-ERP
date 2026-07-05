# V1-SALES-007 - Invoice Cancellation Design Plan

## Classification

INF.

This document defines the V1 invoice cancellation policy only. It does not
implement cancellation, cancellation UI, returns, Product behavior, Inventory
mutation, or localStorage migration.

## Evidence Base

- Accepted baseline tag:
  `v1-sales-006-issued-invoice-read-stock-deduction-audit-view`.
- V1-SALES-005 created `sale_deduction` movements when draft invoices are
  issued.
- V1-SALES-006 made issued invoices and `stockMovementId` audit links visible
  without adding cancellation or reversal behavior.
- Runtime evidence in `outputs/V1-SALES-007/runtime.json` confirms the Invoice
  route is protected, an issued invoice is visible, the related
  `sale_deduction` movement is traceable, no cancellation UI exists, and the
  read-only verification did not mutate invoice, movement, or Product data.

## Current Repository Support

- Invoice statuses already include `draft`, `issued`, and `cancelled`.
- Invoice records already include optional `cancelledAt`, `cancelledBy`, and
  `cancelReason`.
- `InvoiceService.markCancelled(invoiceId, reason)` exists as a status-only
  service method from the persistence baseline.
- No cancellation UI is exposed in the Invoice page.
- Current `markCancelled` does not create stock reversal movements and should
  not be exposed for issued invoices until reversal behavior is implemented.

## Recommended Cancellation Eligibility Policy

### Draft Invoices

Draft invoices have not affected stock and should not use the issued-invoice
stock reversal path.

V1 may later support draft deletion or draft cancellation as a separate,
non-stock-affecting mission. That work should not block issued-invoice
cancellation.

### Issued Invoices

Issued invoices may be cancelled only through an explicit cancellation flow
that:

- validates the invoice belongs to the authenticated `accountId`;
- validates the invoice status is `issued`;
- validates each stock-affecting line has an original `stockMovementId`;
- validates each original movement exists and is a matching `sale_deduction`;
- creates additive stock reversal movements before marking the invoice
  cancelled;
- preserves the original invoice id, invoice number, accountId, issued data,
  and Product snapshot lines.

### Already Cancelled Invoices

Already cancelled invoices cannot be cancelled again.

The cancellation flow must be idempotent and duplicate-safe. Re-running the
same cancellation request must not create duplicate reversal movements. If
existing reversal movements are found for the same original deductions, the
flow should safely return the existing cancelled state or complete missing
invoice metadata without appending duplicates.

## Recommended Invoice Status Policy

The V1 status transition for stock-affecting cancellation is:

```text
issued -> cancelled
```

Required behavior:

- `issued -> cancelled` is allowed only through explicit cancellation flow.
- `cancelledAt` must be set.
- `cancelledBy` must be set from the authenticated user id.
- `cancelReason` should be recorded. V1 UI should require a non-empty reason
  unless the owner explicitly relaxes it.
- `issuedAt`, `issuedBy`, invoice id, invoice number, accountId, totals, and
  Product snapshot lines must remain preserved.
- Cancelled invoices are read-only.
- Draft update UI remains blocked for issued and cancelled invoices.

## Product And Audit Preservation

Invoice cancellation must not:

- delete the invoice;
- hard delete or rewrite original `sale_deduction` movements;
- mutate Product records;
- update `Product.quantity`;
- use Firebase UID or provider user id as `accountId`;
- use any default account fallback.

## Recommended Next Mission

`V1-SALES-008 - Invoice Cancellation / Stock Reversal Implementation`.

Cancellation implementation may proceed next only after Architect / Owner
approval of this design plan.

Returns should not proceed next. Returns require separate business rules and
should remain deferred until invoice cancellation and reversal are implemented
and verified.
