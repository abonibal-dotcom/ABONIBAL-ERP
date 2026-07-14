# V1-SYNC-002 Conflict And Idempotency Policy

## Governing Rule

V1 must prevent silent overwrite. Advanced automatic conflict merging remains
deferred. A conflict pauses the affected operation and exposes a clear manual
resolution path.

Synchronization moves validated state and audit records. It does not re-run
domain commands when pulling cloud data.

## Revision And Compare-And-Set

Every cloud record carries a monotonically increasing `meta.revision`.

- Create succeeds only when the record path is absent.
- Update includes `expectedRevision` and succeeds only on exact match.
- Successful update increments revision once.
- Retry with the same acknowledged operation returns the same result.
- Mismatch creates a local `conflict` state and writes nothing.
- Client timestamps never decide a winner.
- Refresh/latest plus an explicit user retry is the V1 resolution mechanism.

## Repository Policy Matrix

| Module | Mutable? | Immutable after state? | Conflict strategy | Idempotency strategy | Realtime listener? | Migration risk |
| --- | --- | --- | --- | --- | --- | --- |
| Products | Yes, until safe-delete constraints | Historical snapshots are external and unchanged | Revision CAS; manual retry/merge | Stable ID plus operation receipt | Yes, module-scoped | MEDIUM; Date/image normalization |
| Stock movements | Append plus guarded void metadata | Original movement effect/history preserved | Create-if-absent; conflicting ID blocks | Stable movement ID and reference-derived key | Yes | HIGH; inventory totals |
| Invoices | Draft mutable | Issued business content immutable; cancellation is guarded lifecycle | Draft revision CAS; lifecycle operation conflict blocks | Keys for create, issue, cancel, draft tombstone | Yes | HIGH; related StockMovements |
| Invoice returns | Recorded state may execute once | Executed return immutable | Expected status/revision; conflict blocks | Return create and execute keys | Yes | HIGH; return StockMovements |
| Customers | Yes with safe delete | Deleted audit metadata preserved | Revision CAS; manual retry/merge | Stable ID plus operation receipt | Yes | MEDIUM |
| Suppliers | Yes with safe delete | Deleted audit metadata preserved | Revision CAS; manual retry/merge | Stable ID plus operation receipt | Yes | MEDIUM |
| Payments | Draft mutable | Posted/voided business data immutable | Draft revision CAS; guarded post/void | Keys per post and void transition | Yes | HIGH; audit lifecycle |
| Purchases | Draft mutable | Posted/cancelled business data immutable | Draft revision CAS; guarded post/cancel | Keys per post and cancel transition | Yes | HIGH; aggregate lines |
| Expenses | Draft mutable | Posted/voided business data immutable | Draft revision CAS; guarded post/void | Keys per post and void transition | Yes | HIGH; audit lifecycle |
| Safes | Metadata mutable under usage rules | Currency/identity constrained after posted use | Revision CAS plus usage-policy validation | Stable ID plus operation receipt | Yes | MEDIUM/HIGH; derived balance |
| Cash movements | Draft mutable | Posted/reversed history immutable | Draft CAS; append/guarded reversal | Existing key plus operation receipt and transfer unit | Yes | HIGH; balance and transfers |
| Ledger accounts | Mutable under identity-lock rules | Core identity constrained after posted use | Revision CAS plus usage-policy validation | Stable ID plus operation receipt | Yes | HIGH; references/balances |
| Ledger entries | Draft mutable | Posted/reversed history immutable | Draft CAS; append/guarded reversal | Existing key plus post/reversal receipt | Yes | HIGH; double-entry balances |

## Mutable Master Data

Products, Customers, Suppliers, Safe metadata, and permitted LedgerAccount
metadata use optimistic concurrency.

On mismatch:

1. Preserve the user's pending version in the outbox.
2. Fetch and display the latest cloud version.
3. Show changed fields and both revisions.
4. Permit explicit discard, retry against latest, or manual edit.
5. Do not auto-merge fields in V1.

Safe and LedgerAccount usage restrictions must be revalidated against the
latest cloud ledgers before an update is accepted.

## Draft Records

Invoice, Payment, Purchase, Expense, CashMovement, and JournalEntry drafts may
be edited only at the expected revision. Two-device edits do not use
last-write-wins. Draft deletion uses a revisioned tombstone, not RTDB removal.

If another device posts/issues the draft first, a stale draft update fails with
a lifecycle conflict and cannot return the record to draft.

## Immutable And Posted Records

Issued invoices, executed returns, posted Payments/Purchases/Expenses,
posted/reversed CashMovements, posted/reversed JournalEntries, and their audit
links reject arbitrary content updates.

Allowed lifecycle operations are explicit and guarded. For example, invoice
cancellation may set cancellation audit fields and append the accepted reversal
movement as one unit. It may not alter invoice lines or delete the original
sale deduction.

## Append-Only Ledgers

### StockMovement

Create once by stable ID. Void metadata may be applied only by the accepted
void policy and expected revision. The original movement remains stored.

### CashMovement

Posted movement content is immutable. Reversal appends linked opposite
movement records and preserves the original. Transfer and transfer reversal are
multi-record units.

### JournalEntry

Posted entry content and lines are immutable. Reversal appends a balanced,
linked opposite entry and preserves the original. Pulling either entry updates
cache and derived balances only.

## Idempotency Identity

Every outbox unit has:

- a unique stable `operationId`;
- a stable semantic `idempotencyKey`;
- an account ID and module;
- one or more stable record IDs;
- an expected revision per existing record;
- a canonical write-set checksum.

Recommended semantic patterns include:

- `invoice:create:{invoiceId}`
- `invoice:issue:{invoiceId}`
- `invoice:cancel:{invoiceId}`
- `invoice-return:execute:{returnId}`
- `payment:post:{paymentId}`
- `payment:void:{paymentId}`
- `cash:reverse:{movementId}`
- `journal:post:{entryId}`
- `journal:reverse:{entryId}`

The value is stored as data; any value used as an RTDB key must first be encoded
or hashed into a key-safe representation.

## Cloud Operation Receipt

The operation receipt and all record writes must be one atomic write set. A
retry behaves as follows:

1. No receipt and valid expected state: apply once and create receipt.
2. Matching receipt and checksum: return the original acknowledgement.
3. Same key with different checksum: conflict; write nothing.
4. Record exists without a matching receipt: investigate as partial/legacy
   state; do not guess.

For financial operations spanning multiple paths, independent sequential writes
are forbidden. If atomicity cannot be proven with the selected RTDB mechanism,
implementation stops for a trusted backend transaction decision.

## Persistent Outbox

Recommended account-scoped local key:

`syncOutbox:{accountId}`

Each entry contains:

```text
operationId
unitOfWorkId
accountId
module
recordId / recordIds
operationType
expectedRevision / expectedRevisions
idempotencyKey
payload or canonical write-set reference
writeSetChecksum
attemptCount
createdAt
lastAttemptAt
nextAttemptAt
errorCode
status
localAppliedAt
```

Allowed statuses:

- `pending`
- `syncing`
- `acknowledged`
- `conflict`
- `failed`

On restart, a stale `syncing` entry returns to `pending` after reconciliation.
No entry is removed before a matching cloud acknowledgement is validated.

## Retry Policy

- Retry transient network/unavailable failures with exponential backoff and
  jitter.
- Suggested delays: 1s, 2s, 4s, 8s, increasing to a maximum of 5 minutes.
- After 10 failed attempts, mark `failed` and require manual retry.
- Reset the schedule only after a successful acknowledgement or explicit user
  action.
- Do not retry permission, schema, account, validation, or revision conflicts
  automatically.
- Never run an unbounded tight loop.

## Acknowledged Entry Retention

After acknowledgement:

1. Write a compact local receipt under `syncReceipts:{accountId}`.
2. Keep operation ID, idempotency key, record references, result revisions,
   checksum, and acknowledgement time.
3. Do not retain the full payload in the receipt.
4. Remove the item from the active outbox.
5. Retain receipts under a bounded owner-approved policy that is long enough to
   prevent duplicate financial retries.

This is preferred over keeping acknowledged entries forever in the active
queue.

## Pull And Realtime Listener Policy

1. Complete a validated initial pull before marking a module active.
2. Use module-scoped child listeners, not a root/account listener.
3. Validate account ID, record ID, schema, revision, and lifecycle before cache
   application.
4. Compare revisions and ignore exact duplicate/older events.
5. Match `lastOperationId` to suppress local-write echo without ignoring newer
   cloud state.
6. Do not overwrite a cache record with an unresolved pending local operation.
7. Do not run domain commands from listener callbacks.
8. Unsubscribe every listener on logout or account switch.

Example:

`pull posted JournalEntry -> cache entry -> recalculate derived balance`

Not:

`pull posted JournalEntry -> call post() again`

## Conflict Visibility

The minimum visible information is module, record reference, local revision,
cloud revision, operation type, safe error code, and available actions. Raw
UID, raw tokens, credentials, and unrelated record payloads remain hidden.

Conflicts block the affected operation but do not erase local input or stop
unrelated modules unless an account/security/schema failure exists.
