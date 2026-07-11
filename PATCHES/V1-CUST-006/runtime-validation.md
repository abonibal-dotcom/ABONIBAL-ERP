# V1-CUST-006 — Customer Invoice Display Audit

## Runtime Validation

Date: 2026-07-11

## Scope

Audit customer display behavior in invoice flows after `V1-CUST-005`.

This mission did not modify runtime source code.

## Baseline

- Base tag: `v1-cust-005-customer-invoice-selection-integration`
- Branch: `v1/cust-006-customer-invoice-display-audit`
- Source changes: none
- `.env` tracked by Git: no

## Required Validation

- TypeScript: PASS
  - Command used: `pnpm.cmd exec tsc --noEmit`
  - Note: direct `pnpm` in PowerShell resolves to `pnpm.ps1`, which is blocked by local execution policy. The Windows `.cmd` shim was used for the same project command.
- Build: PASS
  - Command used: `pnpm.cmd run build`

## Runtime Method

- Verification tool: Chrome DevTools Protocol direct WebSocket client.
- Server readiness: PASS.
- Runtime URL: `http://localhost:5173/`.
- Server proof: HTTP 200 before browser audit.
- Browser profile: fresh isolated headless profile.
- Credentials: local test credential keys were present; values were not printed.

Two verifier-tool attempts were discarded before final evidence:

- Attempt 1 failed before app startup because Node `spawn()` could not launch `pnpm.cmd` directly in this shell context.
- Attempt 2 reached the app but failed on a post-reload verifier timing step before final gates.

Neither discarded attempt modified source code or produced application failure evidence.

## Scenario

1. Open application.
2. Confirm protected route redirects to Login before authentication.
3. Log in with the approved local Firebase test credentials.
4. Open Customers page and create one registered customer through the UI.
5. Derive the current account scope from the generated `customers:{accountId}` key.
6. Seed an isolated runtime product and opening stock movement inside the fresh browser profile.
7. Open Invoices page.
8. Create a draft invoice with selected registered customer.
9. Edit the draft and confirm the registered customer remains selected.
10. Create a draft invoice with manual customer name.
11. Create a draft invoice without a customer.
12. Issue the registered-customer invoice.
13. Execute one invoice return from the issued invoice line.
14. Reload and confirm displayed customer values persist.
15. Confirm Products, Inventory, and Customers pages still open.

## Results

- Registered customer displayed in invoice draft table: PASS.
- Manual customer name displayed in invoice draft table: PASS.
- No-customer fallback displayed as `بدون عميل`: PASS.
- Editing a draft with registered customer keeps the selected customer: PASS.
- Issuing an invoice keeps the registered customer display: PASS.
- Invoice return controls/audit remain functional and do not break customer display: PASS.
- Products page opens: PASS.
- Inventory page opens: PASS.
- Customers page opens: PASS.
- Console errors: 0.
- Page exceptions: 0.
- `.env` remains untracked: PASS.

## Runtime Evidence Summary

- Registered customer display: `Registered Customer V1 CUST 006`.
- Manual customer display: `Manual Customer V1 CUST 006`.
- No-customer display: `بدون عميل`.
- Registered customer kept during edit: yes.
- Issued invoice customer display: `Registered Customer V1 CUST 006`.
- Return audit entry count: 1.
- Invoice count in isolated runtime profile: 3.
- Executed return count: 1.
- `sale_deduction` movement count: 1.
- `sale_return` movement count: 1.
- Global `localStorage.products` present: no.

## Result

PASS
