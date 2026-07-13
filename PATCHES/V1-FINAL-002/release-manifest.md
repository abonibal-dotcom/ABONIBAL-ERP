# ABONIBAL ERP V1 Release Manifest

## Candidate

- Branch: `v1/final-002-production-readiness-v1-release-seal`
- Base tag: `v1-final-001-full-system-regression-data-boundary-audit`
- Release tag: `v1-final-abonibal-erp-v1-release-seal`
- Release commit: assigned by the V1-FINAL-002 commit
- Status: local release candidate; not deployed

## Completed V1 Phases

| Phase | Latest Accepted Tag | Commit |
| --- | --- | --- |
| Governance integration | `v1-inf-002-governance-integrated` | `0b977cb` |
| Foundation verification | `v1-fnd-001-foundation-verification-baseline` | `bc16fda` |
| Persistence safety and scoped Product import | `v1-per-006-legacy-product-scoped-import` | `c93a9bb` |
| Auth and Route Guard | `v1-auth-015-route-guard-foundation` | `6a5e8ec` |
| Products | `ecs-011-product-module-regression-baseline` | `da98d86` |
| Inventory and availability | `v1-inv-007-stock-availability-invoice-gate` | `a691e3b` |
| Sales, cancellation, and returns | `v1-sales-014-sales-lifecycle-regression-including-returns` | `6b5c23c` |
| Original production regression | `v1-rel-001-full-v1-production-regression-release-candidate` | `e56bcb9` |
| RTL/mobile UI baseline | `v1-ui-003-mobile-tables-rtl-polish` | `a358654` |
| Production handoff | `v1-handoff-001-final-production-package` | `efded86` |
| Previous Firebase production deploy | `v1-deploy-002-firebase-hosting-production-deploy` | `792909c` |
| Customer module | `v1-cust-008-customer-module-closure-audit` | `335a276` |
| Local file hygiene | `v1-hygiene-001-local-untracked-safety-audit` | `890693c` |
| Supplier module | `v1-sup-004-supplier-module-closure-audit` | `8f7fc90` |
| Payments module | `v1-pay-004-payments-module-closure-audit` | `bd8cbf5` |
| Purchases module | `v1-pur-004-purchase-module-closure-audit` | `d7ada46` |
| Expenses module | `v1-exp-005-expense-module-closure-audit` | `7e4004b` |
| Safes / Cash Movements | `v1-cash-007-cash-module-closure-audit` | `0c913b0` |
| Basic Auditable Ledger | `v1-ledger-005-basic-ledger-module-closure-audit` | `a952cde` |
| Full system/data-boundary audit | `v1-final-001-full-system-regression-data-boundary-audit` | `7967e58` |
| Production readiness/release seal | `v1-final-abonibal-erp-v1-release-seal` | this release-seal commit |

All required closure tags were found locally before sealing this candidate.

## Available Modules

- Firebase Login, explicit account/session mapping, logout, and protected routes
- Dashboard
- Products with account-scoped CRUD, search/filter, safe delete, and legacy scoped import
- Inventory StockMovement ledger, manual movements, history, availability, and voiding
- Customers with account-scoped CRUD/safe delete and Invoice customer snapshot selection
- Suppliers with account-scoped CRUD/safe delete
- Sales Invoices with draft, issue, stock deduction, audit, cancellation reversal, partial returns, and return stock restoration
- Payments with manual draft/post/void lifecycle
- Purchases with manual draft/post/cancel lifecycle
- Expenses with manual draft/post/void lifecycle
- Safes and CashMovement ledger with manual movements, transfers, reversal, and derived balances
- Basic Auditable Ledger with manual accounts, balanced Journals, post, reversal, and derived balances

## Approved Integrations

- Auth session to explicit `accountId` ownership boundary
- Product availability through StockMovement ledger
- Invoice issue to `sale_deduction`
- Invoice cancellation to additive `sale_return`
- Invoice Return execution to additive `sale_return`
- Registered Customer selection to immutable Invoice customer snapshot

## Intentionally Independent Modules

- Payments do not auto-update Customer, Supplier, Invoice, Cash, or Ledger balances.
- Purchases do not auto-update Supplier, Product, Inventory, Payment, or Ledger records.
- Expenses do not auto-create Payment, Cash, or Ledger records.
- Cash does not auto-post to Payments, Expenses, Sales, Purchases, or Ledger.
- Basic Ledger accepts manual entries only and does not auto-post from any operational module.
- No default Chart of Accounts is generated.

## Deferred Work

- Payment integration with Customers, Suppliers, Invoices, Cash, and Ledger
- Customer and Supplier balances, statements, allocations, and payment history
- Purchase integration with Suppliers, Products, Inventory, Payments, Cash, and Ledger
- Expense integration with Payments, Cash, and Ledger
- Cash integration with operational source modules
- Sales and Invoice integration with Ledger
- Inventory/COGS and accounting valuation integration
- Default Chart of Accounts and semantic account mappings
- Profit and loss, balance sheet, trial balance, period closing, reconciliation, and tax accounting
- Multi-currency conversion and accounting
- Advanced permissions and role administration
- Multi-branch support
- Advanced analytics and reports
- Advanced import/export and mapping
- Attachments, independent expense categories, and advanced search/filter improvements
- PWA manifest, installability, and offline cache strategy
- Bundle code splitting/performance optimization

Every deferred financial integration requires a separate Owner-approved mission.

## Data Boundaries

- `products:{accountId}`
- `stockMovements:{accountId}`
- `invoices:{accountId}`
- `invoiceReturns:{accountId}`
- `customers:{accountId}`
- `suppliers:{accountId}`
- `payments:{accountId}`
- `purchases:{accountId}`
- `expenses:{accountId}`
- `safes:{accountId}`
- `cashMovements:{accountId}`
- `ledgerAccounts:{accountId}`
- `ledgerEntries:{accountId}`

The legacy global Product key is an explicit import source only, not the active runtime boundary.

## Pre-Deployment Backup

1. Push and Owner-review every new branch/tag through this release-seal tag.
2. Record the currently active Firebase Hosting release in the Firebase Console.
3. Preserve `v1-deploy-002-firebase-hosting-production-deploy` as the previous safe Git version.
4. Export or otherwise preserve each production browser/account's current account-scoped localStorage data using an Owner-approved process.
5. Confirm Firebase Auth test/production account mapping and Hosting target without printing credentials.
6. Re-run TypeScript, production build, and production preview from the release tag.
7. Do not include `.env`, `.firebase/`, `outputs/`, or any local credential file in the deployment package.

## Proposed Deployment Commands

Do not run until Owner approval:

```powershell
git checkout v1-final-abonibal-erp-v1-release-seal
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm run build
firebase deploy --only hosting --project abonibal-production
```

After deploy, smoke-test Login and every protected module route on desktop and mobile before accepting the release.

## Rollback Plan

Previous safe version:

- Tag: `v1-deploy-002-firebase-hosting-production-deploy`
- Commit: `792909c`
- Confirmed production URL: `https://abonibal-production.web.app`

If the new Hosting release fails:

```powershell
git checkout v1-deploy-002-firebase-hosting-production-deploy
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm run build
firebase deploy --only hosting --project abonibal-production
```

Then restore account-local data only from the pre-deployment backup if the failed release changed it. Hosting rollback alone does not alter Firestore/Auth, but browser-local data must be handled independently.
