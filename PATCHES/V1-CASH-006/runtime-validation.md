# V1-CASH-006 Runtime Validation

## Mission

V1-CASH-006 - Cash Runtime Validation Audit

## Classification

QA / Docs-only

## Environment

- Windows PowerShell, Node.js v24.18.0, pnpm Windows shim
- Fresh Vite server and isolated headless Chrome/CDP profile
- Synthetic authenticated account with explicit matching account IDs
- Temporary scoped test data removed after verification

## Safe Audit

| Check | Result |
| --- | --- |
| Create Safe | PASS |
| Update Safe | PASS |
| Exactly one default Safe | PASS |
| Prior default demoted | PASS |
| Deactivate zero-balance Safe | PASS |
| Inactive state survives reload | PASS |
| Safe records survive reload | PASS |

## Cash Movement Audit

| Check | Result |
| --- | --- |
| Opening balance | PASS |
| Cash in | PASS |
| Cash out | PASS |
| Adjustment in/out | PASS |
| Draft has no balance effect | PASS |
| Posted affects balance once | PASS |
| Posted update blocked | PASS |
| Reversal preserves both records and restores effect | PASS |
| Reversed update blocked | PASS |
| No hard delete | PASS |
| Duplicate idempotency key blocked | PASS |
| Duplicate post/reversal creates no write | PASS |
| Negative balance prevented | PASS |
| Inactive Safe movement blocked | PASS |
| Balance and records survive reload | PASS |

## Transfer Audit

| Check | Result |
| --- | --- |
| Same-currency transfer succeeds | PASS |
| Source deducted and destination credited | PASS |
| Shared transferId | PASS |
| Exactly two records per transfer | PASS |
| Same source/destination blocked | PASS |
| Currency mismatch blocked | PASS |
| Negative source balance blocked | PASS |
| Idempotent replay creates no duplicate | PASS |
| Full transfer reversal | PASS |
| Half reversal unavailable | PASS |
| Transfer links and balances survive reload | PASS |

## Runtime Values

- Safes persisted: 4
- Cash movement records persisted: 12
- Main Safe final balance: 210 USD
- Branch Safe final balance: 50 USD
- Reload Safe count: unchanged
- Reload movement count: unchanged
- Rendered Safe rows after reload: unchanged
- Rendered movement rows after reload: unchanged

## Safety Audit

- Storage keys: `safes:{accountId}` and `cashMovements:{accountId}` - PASS
- Global `safes` and `cashMovements` keys absent - PASS
- No `Safe.balance` field - PASS
- Payment, Expense, Sales, Purchase, Product, and Inventory storage unchanged - PASS
- Dashboard, Products, Inventory, Customers, Suppliers, Payments, Purchases, Expenses, Invoices, and Cash pages open - PASS
- Console errors: 0
- Page exceptions: 0
- Runtime source changes in this mission: NONE
- `.env`, `.firebase/`, and `outputs/`: untouched

## Technical Validation

- `git diff --check`: PASS
- `pnpm exec tsc --noEmit`: PASS
- `pnpm run build`: PASS
- Full runtime audit: PASS

## Tool Note

The first CDP attempt reached the page before `Application.start()` registered services. It failed before any test write. The rerun explicitly booted `Container` before service access and completed successfully without source changes.

## Result

PASS
