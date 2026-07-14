# V1-SYNC-002 Sync Architecture Contract

## Mission Boundary

- Classification: INF / Architecture / Data Safety / Sync Design
- Base tag: `v1-sync-001-multi-device-firebase-sync-audit`
- Firebase implementation target: `abonibal-erp-test`
- Production: FROZEN / OUT OF SCOPE
- Runtime source changes in this mission: NONE

This document defines the recommended architecture for owner review. It does
not authorize implementation, Firebase rule changes, data writes, migration,
deployment, or a production cutover.

## Existing State

V1-SYNC-001 proved that all thirteen repositories use one synchronous
`LocalStorageDriver`. Firebase is currently used only for Auth and the
Firestore account mapping. No RTDB client, cloud repository, pull, listener,
outbox, retry path, or `SyncManager` exists.

The accepted source-of-truth rules remain unchanged:

- Stock quantity is derived from `StockMovement`, not `Product.quantity`.
- Safe balance is derived from `CashMovement`, not a mutable Safe balance.
- Ledger balance is derived from posted `JournalEntry` history, not a mutable
  LedgerAccount balance.
- Pulling records must never re-run invoice, return, cash, or journal commands.

## Recommended Canonical Model

### Before migration and cutover

For each module not yet migrated, its existing account-scoped local storage
remains the only active persistence path. Enabling partial cloud code must not
silently hide, replace, or upload existing local records.

### After verified migration and explicit cutover

Firebase Realtime Database becomes the shared canonical persistence layer for
operational records. `localStorage` remains:

1. An account-scoped local cache.
2. An offline cache.
3. A persistent outbox and local sync receipt store.
4. Rollback evidence until the owner closes the migration window.

Local cache content must never be treated as a separate winning source after
cutover. Cloud acknowledgement and revision state determine synchronization.

## Account Boundary

The approved cloud root is:

`accounts/{accountId}/...`

The Firebase UID is an authentication and membership identity only. It must
never replace the application `accountId`, appear as the operational data root,
or provide a fallback when account mapping fails.

The proposed thirteen module collections are appropriate:

- `accounts/{accountId}/products/{recordId}`
- `accounts/{accountId}/stockMovements/{recordId}`
- `accounts/{accountId}/invoices/{recordId}`
- `accounts/{accountId}/invoiceReturns/{recordId}`
- `accounts/{accountId}/customers/{recordId}`
- `accounts/{accountId}/suppliers/{recordId}`
- `accounts/{accountId}/payments/{recordId}`
- `accounts/{accountId}/purchases/{recordId}`
- `accounts/{accountId}/expenses/{recordId}`
- `accounts/{accountId}/safes/{recordId}`
- `accounts/{accountId}/cashMovements/{recordId}`
- `accounts/{accountId}/ledgerAccounts/{recordId}`
- `accounts/{accountId}/ledgerEntries/{recordId}`

This layout preserves the account boundary, avoids whole-array writes, permits
record-level listeners, and keeps existing stable IDs.

## Shared Sync Runtime

The implementation should use shared infrastructure rather than thirteen
independent sync systems.

### Firebase runtime

Initializes Auth, Firestore account mapping, and RTDB from one verified TEST
configuration. It must fail closed if the configured project is not
`abonibal-erp-test` during TEST implementation missions.

The tracked `.firebaserc` currently defaults to production. Future Firebase CLI
commands must therefore always include `--project abonibal-erp-test`; the
default alias must never be trusted for sync development or validation.

### AccountMembershipGate

Accepts an authenticated session only after:

1. Firebase Auth is active.
2. Firestore resolves an explicit `accountId`.
3. `session.account.id` matches `session.user.accountId`.
4. RTDB membership authorizes the Firebase user for that account.

Failure leaves sync disabled and exposes a safe error without falling back to
another account.

### CloudRepositoryAdapter

A generic adapter owns path construction, envelope validation, revision
compare-and-set, create-if-absent, operation receipts, and server
acknowledgement. Module policy objects retain domain-specific lifecycle rules.

### SyncCoordinator

One coordinator per authenticated account owns:

- bootstrap state;
- module registration;
- outbox processing;
- retry scheduling;
- listener start/stop;
- account switch isolation;
- conflict and failure reporting;
- acknowledgement and echo suppression.

It must never contain domain commands such as `issueInvoice()` or
`postJournalEntry()`.

### PersistentOutbox

The outbox is account-scoped and persisted locally before a local cache write
is considered durable. It carries record write sets, not instructions to
re-run business commands.

### PullListenerCoordinator

Performs an initial module bootstrap and then installs module-scoped listeners.
It validates cloud envelopes and updates the local cache directly. It never
calls business mutation services when applying cloud records.

### SyncStatus

The minimum states are:

`disabled`, `preflight`, `bootstrapping`, `active`, `offline`, `conflict`,
`failed`, and `stopped`.

The state must be observable by support UI without exposing UID, raw
`accountId`, tokens, or credentials.

## Write Contract

For a new local business operation after cutover:

1. The existing domain service validates and computes the result exactly once.
2. Stable record IDs, `operationId`, `idempotencyKey`, expected revisions, and
   the complete record write set are generated.
3. The pending outbox entry is persisted first.
4. The same write set is applied to the local cache and marked locally applied.
5. The UI may report local/offline success, but not cloud sync success.
6. The coordinator submits an atomic or transactionally guarded cloud write.
7. Cloud validation checks membership, account boundary, lifecycle,
   create/update policy, revision, and idempotency receipt.
8. On acknowledgement, the cache stores the cloud revision and a bounded local
   receipt, then removes the entry from the active outbox.
9. On conflict, permission denial, or validation failure, the entry remains
   visible and no silent overwrite occurs.

The outbox-first order allows restart recovery if the browser closes between
local steps. Startup reconciliation must safely complete an operation that is
pending but not yet reflected in cache.

## Cross-Record Financial Operations

Invoice issue/cancellation/return, Safe transfer/reversal, and similar flows
produce more than one related record. Their sync write set must be committed as
one idempotent unit containing every resulting canonical record and one
operation receipt.

A generic sequence of independent writes is forbidden. If a client-only RTDB
implementation cannot prove atomic compare-and-set behavior for the complete
write set, the responsible implementation mission must stop and open a trusted
backend transaction design. Low TEST traffic is not a substitute for
correctness.

## Read And Bootstrap Contract

1. Wait for Firebase Auth and Firestore account resolution.
2. Verify RTDB membership for the resolved account.
3. Load local cache and pending outbox for that account only.
4. Read cloud records by module, validating path account and record envelope.
5. Merge by record ID and revision without overwriting pending local changes.
6. Classify mismatches as conflicts.
7. Verify bootstrap counts and required reference integrity.
8. Install module-scoped listeners.
9. Mark sync active only after every required module passes bootstrap.

No listener may start before account resolution. All listeners must unsubscribe
before logout or account switch.

## Pull Is State Replication, Not Command Replay

Correct:

`cloud Invoice + cloud StockMovement -> validate -> cache both -> derive stock`

Forbidden:

`pull issued Invoice -> call issueInvoice() -> create another StockMovement`

The same rule applies to InvoiceReturn, Payment, Purchase, Expense,
CashMovement, and JournalEntry records. Sync moves canonical state and audit
records; only an explicit user command creates new domain side effects.

## Offline Contract

- Authenticated users may continue approved local operations while offline only
  after a successful account bootstrap.
- Every offline mutation requires a durable outbox entry.
- Pending operations survive restart.
- Retry uses bounded exponential backoff and never a tight loop.
- Permission, schema, and lifecycle failures do not auto-retry forever.
- Conflicts require visible manual action; advanced automatic merge remains
  outside V1.
- Logging out stops processing. Pending entries remain account-scoped and are
  inaccessible to another account.

## Data Class Boundaries

### Mutable master data

Products, Customers, Suppliers, Safe metadata, and permitted LedgerAccount
metadata use optimistic revision checks. A mismatch blocks the write and
requires latest-data review.

### Draft records

Invoice, Purchase, Payment, Expense, CashMovement, and JournalEntry drafts use
revision checks. One device must not silently erase another device's draft.

### Immutable or posted records

Issued/posted/executed records reject arbitrary field changes. Only an approved
lifecycle transition with its required audit records may change lifecycle
metadata.

### Append-only ledgers

StockMovement, posted CashMovement, and posted JournalEntry history are never
deleted or destructively merged. Corrections preserve originals through
existing void/reversal contracts.

## Activation And Cutover Gates

Cloud canonical mode may be enabled only after:

1. Owner approval of SYNC-DEC-001 through SYNC-DEC-024.
2. TEST account membership and rules verification.
3. Shared runtime and module adapter validation.
4. Complete non-destructive migration dry run.
5. Zero unresolved conflicts.
6. Counts, IDs, hashes, references, and derived balances match.
7. Second-device bootstrap succeeds.
8. Offline/retry/conflict tests pass.
9. Owner explicitly approves cutover.

Production remains frozen and requires a separate future approval and mission.
