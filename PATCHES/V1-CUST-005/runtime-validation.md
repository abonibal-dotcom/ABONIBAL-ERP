# V1-CUST-005 — Customer Invoice Selection Integration

## Runtime Validation

Date: 2026-07-09

## Scope

Integrate customer selection into invoice draft creation.

## Tested Results

- Registered customer field appears in invoice form: PASS
- Customer list includes saved customer: PASS
- Draft invoice can be saved with registered customer: PASS
- Customer name appears in invoice table: PASS
- Editing draft keeps selected customer: PASS
- Draft invoice can be saved without registered customer: PASS
- Products page opens: PASS
- Inventory page opens: PASS
- Customers page opens: PASS

## Evidence

Invoice drafts now support selecting a saved customer while preserving the ability to create invoices without a customer.

## Out of Scope

- No customer balances
- No payments
- No customer statement
- No inventory logic changes
- No product logic changes
- No invoice deletion changes
