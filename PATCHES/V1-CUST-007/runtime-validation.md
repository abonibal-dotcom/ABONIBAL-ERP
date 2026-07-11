# V1-CUST-007 Runtime Validation

## Mission

V1-CUST-007 — Customer Invoice Data Consistency Audit

## Classification

QA / Data Consistency Audit

## Test Environment

- Repository: ABONIBAL-ERP
- Branch: `v1/cust-007-customer-invoice-data-consistency-audit`
- Base tag: `v1-hygiene-001-local-untracked-safety-audit`
- Runtime: Vite dev server on `http://127.0.0.1:5187`
- Verification tool: Chrome CDP external temporary script
- Runtime data scope: synthetic account `acct-v1-cust-007-audit`
- Auth mode: controlled in-memory `AuthStateService` session for data consistency audit only
- Credentials: not read, not printed, not used
- `.env`: not read or printed
- `.firebase/`: not touched
- `outputs/`: not written by this mission

## Technical Validation

- `pnpm exec tsc --noEmit`: PASS
- `pnpm run build`: PASS
- Runtime verification: PASS
- Console errors count: 0
- Page exceptions count: 0

## Exact Checklist Results

| Check | Result |
| --- | --- |
| Registered customer invoice keeps `customerId` | PASS |
| Registered customer invoice keeps `customerSnapshot` | PASS |
| Registered customer invoice table displays snapshot | PASS |
| Manual customer invoice saves without `customerId` | PASS |
| Manual customer invoice keeps manual `customerSnapshot.displayName` | PASS |
| Manual customer invoice table displays manual customer name | PASS |
| No-customer invoice saves without `customerId` | PASS |
| No-customer invoice allows null/empty `customerSnapshot` | PASS |
| No-customer invoice displays `بدون عميل` | PASS |
| Draft edit keeps selected registered customer | PASS |
| Draft edit preserves `customerId` | PASS |
| Draft edit preserves `customerSnapshot` | PASS |
| Issuing invoice succeeds | PASS |
| Issued invoice keeps `customerId` | PASS |
| Issued invoice keeps `customerSnapshot` | PASS |
| Issued invoice display remains correct | PASS |
| Customer rename does not mutate invoice snapshot | PASS |
| Customer rename leaves invoice display on saved snapshot | PASS |
| Customer safe-delete succeeds | PASS |
| Customer safe-delete leaves invoice snapshot display intact | PASS |
| Customer safe-delete does not break return controls/audit | PASS |
| Reload preserves registered customer invoice display | PASS |
| Reload preserves manual customer invoice display | PASS |
| Reload preserves no-customer invoice display | PASS |
| Products page opens | PASS |
| Inventory page opens | PASS |
| Customers page opens | PASS |
| Invoices page opens | PASS |

## Registered Customer Consistency Result

PASS.

An invoice created with a saved active customer retained:

- `customerId`
- `customerSnapshot.displayName`
- customer display in the invoice table from the invoice snapshot

After issuing the invoice, both `customerId` and `customerSnapshot` remained present and the displayed customer name remained correct.

## Manual Customer Consistency Result

PASS.

An invoice created without a registered customer and with a manual customer name:

- saved without `customerId`
- saved `customerSnapshot.displayName`
- displayed the manual customer name in the invoice table

## No-Customer Consistency Result

PASS.

An invoice created without a registered customer and without a manual customer name:

- saved successfully
- did not require `customerId`
- kept `customerSnapshot` as null/empty by design
- displayed the fallback `بدون عميل`

## Draft Edit Consistency Result

PASS.

Opening the registered-customer draft for edit kept the registered customer selected. Re-saving through the accepted service boundary preserved both `customerId` and `customerSnapshot`.

## Issue Invoice Consistency Result

PASS.

Issuing the registered-customer invoice preserved:

- invoice id
- `customerId`
- `customerSnapshot`
- displayed customer name

## Customer Rename-After-Invoice Observed Behavior

PASS.

After changing the saved customer's display name, the existing invoice continued to display the original invoice snapshot. The invoice record was not updated to the renamed customer value.

Observed behavior: invoice display is snapshot-stable.

## Customer Safe-Delete-After-Invoice Observed Behavior

PASS.

After safe-deleting a customer referenced by an issued invoice:

- the customer was no longer returned by active customer lookup
- the invoice continued to display the saved customer snapshot
- invoice return controls/audit remained available
- no runtime crash occurred

Observed behavior: invoice display remains independent from the active customer record after safe-delete.

## Reload Persistence Result

PASS.

After reload, invoice customer display remained correct for:

- registered customer invoice
- manual customer invoice
- no-customer invoice

## Regression Result

PASS.

The following pages opened successfully during runtime verification:

- Products
- Inventory
- Customers
- Invoices

## Known Limitation / Finding

The runtime verification used a controlled synthetic authenticated session because test credentials were not present in the shell environment and this mission targets customer/invoice data consistency, not Firebase authentication. No source code was changed to enable this verification.

