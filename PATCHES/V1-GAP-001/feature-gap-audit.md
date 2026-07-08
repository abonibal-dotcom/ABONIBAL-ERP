# V1-GAP-001 Feature Gap Audit

Mission: V1-GAP-001 — Production Feature Gap Audit
Classification: AUDIT / DOC-only
Baseline: v1-deploy-002-firebase-hosting-production-deploy
Branch: v1/gap-001-production-feature-gap-audit

## Purpose

Audit the current production-deployed ABONIBAL ERP V1 feature surface and identify missing ERP sections before adding new runtime features.

This mission does not change runtime application code.

## Current Production Feature Surface

The current V1 production application contains these functional modules:

- Auth
- Products
- Inventory
- Sales / Invoices
- Invoice Returns

The current route registry exposes:

- Dashboard
- Login
- Products
- Inventory
- Invoices

## Current Service Registration

The current dependency container registers business services for:

- ProductService
- InventoryService
- InvoiceService
- InvoiceReturnService

No independent services currently exist for:

- Customers
- Suppliers
- Partners
- Expenses
- Payments / Collections
- Reports
- Settings
- User Management / Permission Matrix

## Current Persistence Boundaries

The current accepted account-scoped storage keys are:

- products:{accountId}
- stockMovements:{accountId}
- invoices:{accountId}
- invoiceReturns:{accountId}

No account-scoped storage keys currently exist for:

- customers:{accountId}
- suppliers:{accountId}
- partners:{accountId}
- expenses:{accountId}
- payments:{accountId}
- reports configuration
- settings:{accountId}
- users / permissions management

## Customer Capability Finding

Customers are partially represented inside invoices only.

The Invoice model currently supports:

- optional customerId
- customerSnapshot

This means invoices can store a customer name snapshot, but there is no independent Customer module yet.

Missing customer capabilities:

- Customer list
- Customer create / edit / safe delete
- Customer phone / address / notes
- Customer balance
- Customer statement
- Invoice customer picker
- Customer-linked invoice history
- Customer payments / collections

## Supplier Capability Finding

No independent Supplier module currently exists.

Missing supplier capabilities:

- Supplier list
- Supplier create / edit / safe delete
- Supplier contact data
- Supplier balance
- Supplier purchase history
- Supplier payments
- Supplier statement

## Partner Capability Finding

No independent Partner module currently exists.

Missing partner capabilities:

- Partner list
- Capital / share tracking
- Partner withdrawals
- Partner profit allocation
- Partner balance
- Partner statement

Partner accounting should not be implemented before customers, suppliers, expenses, and payments are stable.

## Expense Capability Finding

No independent Expense module currently exists.

Missing expense capabilities:

- Expense categories
- Expense entry
- Expense date / amount / notes
- Expense payment method
- Expense reports
- Profit impact

Expenses are required before reliable profit reporting.

## Payment / Collection Capability Finding

No independent Payment module currently exists.

Missing payment capabilities:

- Customer collections
- Supplier payments
- Partner withdrawals
- Payment method
- Payment reference
- Account-scoped payment ledger
- Payment reversal / voiding rules

Payments should be ledger-based and auditable.

## Report Capability Finding

Basic reporting is referenced in roadmap-level documentation, but no runtime Reports section is currently implemented.

Missing report capabilities:

- Sales report
- Inventory report
- Customer balances
- Supplier balances
- Expense report
- Profit report
- Partner report
- Daily movement report

Reports should be added only after their source modules are stable.

## Settings Capability Finding

No independent Settings section currently exists in the V1 production application.

Missing settings capabilities:

- Store profile
- Invoice header/footer settings
- Logo configuration
- Currency / tax defaults
- Backup/export controls
- Public/demo mode settings
- User-facing app preferences

Settings must preserve account boundaries.

## User Management / Permissions Finding

The current role foundation supports minimal V1 roles:

- owner
- user

However, no management UI exists for:

- User list
- User invitations
- Role changes
- Permission matrix
- Per-section access control

Advanced roles and permission matrix should remain a later phase unless required by the owner.

## Current ERP Completion Status

The current deployed system is a stable production nucleus, not a complete commercial ERP.

Current nucleus:

- Auth
- Products
- Inventory ledger
- Invoices
- Invoice returns
- Production hosting

Missing commercial ERP sections:

- Customers
- Suppliers
- Expenses
- Partners
- Payments / Collections
- Reports
- Settings
- User Management

## Recommended Implementation Order

Recommended safe order:

1. Customers
2. Suppliers
3. Expenses
4. Payments / Collections
5. Reports
6. Partners
7. Settings
8. User Management / Permissions

## Recommended Next Mission

Recommended next mission:

V1-CUST-001 — Customer Domain Baseline

Scope should be limited to customer model, account-scoped persistence key, repository, validator, and service.

Do not connect Customers to invoices until the customer domain baseline is stable.

## Safety Rules For Future Implementation

Future modules must follow these rules:

- Do not alter existing accepted storage keys.
- Do not mutate legacy localStorage data destructively.
- Do not use Firebase UID or providerUserId as accountId.
- Use explicit accountId boundaries.
- Add new account-scoped keys only.
- Keep Product.quantity as legacy compatibility only.
- Keep Inventory ledger as stock source of truth.
- Do not hard-delete issued invoices.
- Preserve invoice stock movement audit behavior.
- Add one module at a time.
- Verify TypeScript, build, runtime, and storage safety after each mission.

## Final Assessment

ABONIBAL ERP V1 is production-deployed and stable, but commercially incomplete.

The correct next engineering direction is controlled module expansion, beginning with Customers.
