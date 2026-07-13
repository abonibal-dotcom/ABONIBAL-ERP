# V1-FINAL-001 Runtime Validation

## Mission

V1-FINAL-001 - Full System Regression and Data Boundary Audit

## Classification

QA / Final System Audit / Docs-only

## Environment

- Windows PowerShell, Node.js v24.18.0, pnpm Windows shim
- Fresh Vite server on `127.0.0.1:5195`, proven by live process, listening port, clean startup log, and HTTP 200
- Fresh isolated headless Chrome/CDP profile
- Synthetic authenticated account with an unrelated second account for isolation proof
- True reload between lifecycle and persistence phases
- All temporary scoped records removed after verification

## Changed Files

- `PATCHES/V1-FINAL-001/runtime-validation.md`
- `PATCHES/V1-FINAL-001/closure-report.md`

Runtime source changes: NONE.

## Authentication And Navigation

| Check | Result |
| --- | --- |
| Login page renders | PASS |
| Unauthenticated protected route redirects to Login | PASS |
| Authenticated account context enables protected routes | PASS |
| Dashboard | PASS |
| Products | PASS |
| Inventory | PASS |
| Customers | PASS |
| Suppliers | PASS |
| Invoices | PASS |
| Payments | PASS |
| Purchases | PASS |
| Expenses | PASS |
| Safes / Cash Movements | PASS |
| Basic Ledger | PASS |

The runtime account id was explicit and different from the authenticated user/provider identity. The accepted Firebase account-mapping boundary remains the authority for a real login session.

## Module Lifecycle Results

| Module | Verified Lifecycle | Result |
| --- | --- | --- |
| Products | create, edit, safe delete, deleted hidden | PASS |
| Inventory | opening, manual adjustment, non-destructive void, quantity derivation | PASS |
| Customers | create, edit, safe delete | PASS |
| Suppliers | create, edit, safe delete | PASS |
| Invoices | draft create/edit, issue, deduction, cancellation/reversal | PASS |
| Invoice Returns | partial record and stock-restoration execution | PASS |
| Payments | draft create/edit, post, edit block, void | PASS |
| Purchases | draft create/edit, post, edit block, cancel | PASS |
| Expenses | draft create/edit, post, edit block, void | PASS |
| Safes / Cash | safe create/edit/deactivate, openings, atomic transfer, transfer reversal | PASS |
| Basic Ledger | manual accounts, balanced draft, post, linked reversal | PASS |

## Reload Persistence

| Check | Result |
| --- | --- |
| Product and Inventory quantity survive reload | PASS |
| Customers and Suppliers survive reload | PASS |
| Issued and cancelled Invoices survive reload | PASS |
| Executed Invoice Return survives reload | PASS |
| Voided Payment survives reload | PASS |
| Cancelled Purchase survives reload | PASS |
| Voided Expense survives reload | PASS |
| Cash movements re-derive Safe balances after reload | PASS |
| Journals re-derive Ledger balances after reload | PASS |
| Authenticated navigation works after runtime rehydration | PASS |

## Account-Scoped Storage Audit

| Key | Exists For Audit Account | Global Operational Key Absent | Second Account Empty |
| --- | --- | --- | --- |
| `products:{accountId}` | PASS | PASS | PASS |
| `stockMovements:{accountId}` | PASS | PASS | PASS |
| `invoices:{accountId}` | PASS | PASS | PASS |
| `invoiceReturns:{accountId}` | PASS | PASS | PASS |
| `customers:{accountId}` | PASS | PASS | PASS |
| `suppliers:{accountId}` | PASS | PASS | PASS |
| `payments:{accountId}` | PASS | PASS | PASS |
| `purchases:{accountId}` | PASS | PASS | PASS |
| `expenses:{accountId}` | PASS | PASS | PASS |
| `safes:{accountId}` | PASS | PASS | PASS |
| `cashMovements:{accountId}` | PASS | PASS | PASS |
| `ledgerAccounts:{accountId}` | PASS | PASS | PASS |
| `ledgerEntries:{accountId}` | PASS | PASS | PASS |

Every stored runtime record retained the same explicit authenticated `accountId`. Switching the shared Auth state to a second account returned zero records from all thirteen services and did not create second-account keys.

The source still declares legacy `localStorage.products` solely as the explicit, owner-triggered legacy import source accepted in V1-PER-006. It was absent and untouched in this audit and is not an active operational persistence key.

## Source-Of-Truth Audit

### Inventory

- Stock after opening, issue, partial return, second issue, and cancellation: `97`
- Product compatibility field remained `999` before and after all Inventory/Sales operations
- Product storage remained byte-identical through movement and invoice operations
- `stockMovements:{accountId}` record count: `6`, including a preserved voided manual adjustment
- Result: StockMovement ledger is authoritative; `Product.quantity` is not authoritative

### Safes / Cash

- Main Safe derived balance after transfer and reversal: `500`
- Second Safe derived balance after transfer and reversal: `100`
- `cashMovements:{accountId}` record count: `6`
- Safe records contain no mutable `balance` field
- Result: CashMovement ledger is authoritative

### Basic Ledger

- Manual Journal posted and then reversed
- Derived Cash account balance after reversal: `0`
- `ledgerEntries:{accountId}` record count: `2`, preserving original and reversal
- LedgerAccount records contain no mutable `balance` field
- Result: JournalEntry history is authoritative

## Integration And Audit Safety

- Sales/Invoice stock deduction, cancellation reversal, and Invoice Return restoration are the accepted Inventory integrations and passed.
- Payments, Purchases, and Expenses did not mutate Stock, Invoices, Customers, Suppliers, Cash, or Ledger.
- Cash did not auto-post to Ledger.
- Inventory and Sales did not auto-post to Ledger.
- No automatic Ledger accounts were created.
- Posted/voided/cancelled/reversed records remained present; no lifecycle hard delete occurred.
- Product, Customer, and Supplier deletion remained safe-delete only.
- No double-posting or unapproved integration was observed.
- Console errors: 0
- Page exceptions: 0

## Technical Validation

- `git diff --check`: PASS
- `pnpm exec tsc --noEmit`: PASS
- `pnpm run build`: PASS
- Full runtime regression: PASS
- Reload persistence: PASS
- Account isolation: PASS

## Scope Safety

- Documentation changes only
- No `.env` contents read or printed
- `.firebase/` and `outputs/` untouched
- No push or deployment

## Result

PASS
