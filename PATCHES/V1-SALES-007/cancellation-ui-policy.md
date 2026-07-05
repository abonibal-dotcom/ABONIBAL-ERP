# V1-SALES-007 - Cancellation UI Policy

## Classification

INF.

This document defines the future V1 UI policy for invoice cancellation. It does
not add UI.

## Current UI State

Runtime evidence confirms:

- the Invoice route is protected;
- issued invoices are visible in the existing read/audit view;
- line `stockMovementId` is visible;
- no cancellation UI exists;
- no reversal movement is created by the current UI.

## Recommended V1 UI Policy

Cancellation action should be visible only for issued invoices that are eligible
for cancellation.

The UI must not show cancellation for:

- draft invoices;
- already cancelled invoices;
- invoices missing required stock deduction references;
- invoices outside the authenticated `accountId`.

## Confirmation Policy

Cancellation must require an explicit confirmation.

The user should provide a cancellation reason. For V1, a non-empty reason is
recommended because cancellation affects stock and audit history.

## Read-Only Policy

- Issued invoices remain blocked from draft editing.
- Cancelled invoices are read-only.
- Product snapshot line data remains displayed from the invoice record.
- The audit view should show the original deduction movement and the reversal
  movement after implementation.

## Post-Cancellation Display

After cancellation is implemented, the issued invoice audit view should display:

- status `cancelled`;
- `cancelledAt`;
- `cancelledBy` if display-safe;
- cancellation reason;
- original `stockMovementId`;
- reversal movement id or trace reference;
- no edit action;
- no issue action;
- no second cancel action.

## Exclusions

The cancellation UI policy does not include:

- returns UI;
- partial returns;
- invoice hard delete;
- financial settlement;
- Product CRUD changes;
- Inventory manual adjustment changes.

Returns should be planned only after cancellation and stock reversal pass their
implementation and runtime verification mission.
