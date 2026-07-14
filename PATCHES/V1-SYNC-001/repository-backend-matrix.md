# V1-SYNC-001 Repository Backend Matrix

## Common Wiring

Every repository below receives the same `LocalStorageDriver` created by
`Container.boot()`. Reads and writes are synchronous browser-local operations.
No repository has a Firebase adapter, cloud mirror, initial pull, realtime
listener, manual sync operation, or retry/outbox mechanism.

| Module / repository | Accepted scoped key | Backend | Read path | Write path | Second-device result | Sync |
| --- | --- | --- | --- | --- | --- | --- |
| Products / `ProductRepository` | `products:{accountId}` | localStorage only | `LocalStorageDriver.read` on service/page load | add/update/import uses `LocalStorageDriver.write` | Cannot fetch laptop records | none |
| Stock movements / `StockMovementRepository` | `stockMovements:{accountId}` | localStorage only | reads the scoped movement array | append/void rewrites the scoped array | Cannot fetch laptop ledger | none |
| Invoices / `InvoiceRepository` | `invoices:{accountId}` | localStorage only | reads the scoped invoice array | draft/issue/cancel/delete-draft rewrites the scoped array | Cannot fetch laptop invoices | none |
| Invoice returns / `InvoiceReturnRepository` | `invoiceReturns:{accountId}` | localStorage only | reads the scoped return array | create/execute updates the scoped array | Cannot fetch laptop returns | none |
| Customers / `CustomerRepository` | `customers:{accountId}` | localStorage only | reads the scoped customer array | add/update/safe-delete rewrites the scoped array | Cannot fetch laptop customers | none |
| Suppliers / `SupplierRepository` | `suppliers:{accountId}` | localStorage only | reads the scoped supplier array | add/update/safe-delete rewrites the scoped array | Cannot fetch laptop suppliers | none |
| Payments / `PaymentRepository` | `payments:{accountId}` | localStorage only | reads the scoped payment array | draft/update/post/void rewrites the scoped array | Cannot fetch laptop payments | none |
| Purchases / `PurchaseRepository` | `purchases:{accountId}` | localStorage only | reads the scoped purchase array | draft/update/post/cancel rewrites the scoped array | Cannot fetch laptop purchases | none |
| Expenses / `ExpenseRepository` | `expenses:{accountId}` | localStorage only | reads the scoped expense array | draft/update/post/void rewrites the scoped array | Cannot fetch laptop expenses | none |
| Safes / `SafeRepository` | `safes:{accountId}` | localStorage only | reads the scoped safe array | create/update/deactivate rewrites the scoped array | Cannot fetch laptop safes | none |
| Cash movements / `CashMovementRepository` | `cashMovements:{accountId}` | localStorage only | reads the scoped cash ledger | append/status changes rewrite the scoped array | Cannot fetch laptop cash ledger | none |
| Ledger accounts / `LedgerAccountRepository` | `ledgerAccounts:{accountId}` | localStorage only | reads the scoped account array | create/update/deactivate rewrites the scoped array | Cannot fetch laptop accounts | none |
| Journal entries / `JournalEntryRepository` | `ledgerEntries:{accountId}` | localStorage only | reads the scoped journal array | draft/update/post/reversal rewrites the scoped array | Cannot fetch laptop journal | none |

## Key Findings

1. The thirteen names are account-scoped only within one browser's local
   storage namespace.
2. None of the key helpers produces a Firebase path.
3. None of the repositories can read records created by another browser.
4. Financial idempotency and audit rules operate on the local arrays only; a
   future cloud implementation must preserve those invariants under concurrent
   devices.
5. There is no old `SyncManager` that covers a subset of modules. No sync
   manager exists in current application source.

## Backend Summary

- localStorage only: 13/13
- Firebase only: 0/13
- local + Firebase sync: 0/13
- unknown/broken: 0/13
- multi-device capable: 0/13
