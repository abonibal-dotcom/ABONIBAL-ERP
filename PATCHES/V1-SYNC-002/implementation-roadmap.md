# V1-SYNC-002 Implementation Roadmap

## Execution Rule

No mission below starts until the owner approves SYNC-DEC-001 through
SYNC-DEC-024. Each mission uses a separate branch/commit/tag, targets
`abonibal-erp-test` explicitly, preserves local data, and stops on a security,
schema, lifecycle, conflict, or atomicity failure.

No mission in this roadmap was implemented by V1-SYNC-002.

## Roadmap Summary

| Mission | Scope | Dependencies | Runtime risk | Migration risk |
| --- | --- | --- | --- | --- |
| V1-SYNC-003 | RTDB security and account membership | Approved decisions | HIGH | LOW |
| V1-SYNC-004 | Shared sync runtime and persistent outbox | SYNC-003 | HIGH | LOW |
| V1-SYNC-005 | Products/Customers/Suppliers sync | SYNC-004 | MEDIUM | MEDIUM |
| V1-SYNC-006 | StockMovement sync | SYNC-005 | HIGH | HIGH |
| V1-SYNC-007 | Invoice/Return/Payment/Purchase/Expense sync | SYNC-006 | HIGH | HIGH |
| V1-SYNC-008 | Safe/Cash/Ledger sync | SYNC-007 | HIGH | HIGH |
| V1-SYNC-009 | Non-destructive local-to-cloud migration tool | SYNC-005 through 008 | HIGH | CRITICAL |
| V1-SYNC-010 | Initial pull and second-device bootstrap | SYNC-009 | HIGH | HIGH |
| V1-SYNC-011 | Conflict/offline/retry validation | SYNC-010 | HIGH | MEDIUM |
| V1-SYNC-012 | Sync module closure audit | SYNC-011 | LOW | LOW |

## V1-SYNC-003 - Firebase RTDB Security And Account Membership Foundation

### Scope

- Implement TEST-only account membership path and Rules.
- Add a trusted provisioning procedure; no client membership writes.
- Validate path account and record account equality.
- Deny unauthenticated, other-account, self-grant, and delete attempts.

### Dependencies

- SYNC-DEC-002, 003, 004, 023, and 024 approved.
- Approved TEST Auth user and explicit account mapping.

### Validation gates

- Explicit project proof: `abonibal-erp-test`.
- Authorized TEST canary access: PASS.
- Cross-account and self-grant: DENIED.
- Production touched: NO.
- Rules rollback artifact prepared.

## V1-SYNC-004 - Shared Firebase Sync Runtime And Outbox Foundation

### Scope

- Add Firebase Database client configuration.
- Add `CloudRecordEnvelope`, account path helper, membership gate,
  `SyncCoordinator`, persistent outbox, local receipts, retry scheduler, and
  listener lifecycle.
- Keep all module repositories on local-only mode initially.

### Dependencies

- SYNC-003 security foundation.
- SYNC-DEC-005 through 009, 014, 021, and 022 approved.

### Validation gates

- No operational module writes yet.
- Outbox survives restart.
- Acknowledgement and retry are idempotent on a TEST canary.
- Logout/account switch unsubscribes and isolates caches.
- Permission/schema failures are visible and non-retrying.

## V1-SYNC-005 - Master Data Repository Sync

### Scope

- Add cloud adapters for Products, Customers, and Suppliers.
- Add revision CAS, module listeners, safe-delete propagation, and conflicts.
- Normalize Product Date fields and reject oversized embedded images.

### Dependencies

- SYNC-004 runtime.
- Master-data conflict policy approved.

### Validation gates

- Two-device create/update/reload.
- Same-record concurrent edit creates visible conflict.
- Safe delete does not resurrect.
- Existing local records are not auto-uploaded before SYNC-009.
- Account isolation and no silent overwrite.

## V1-SYNC-006 - Inventory Ledger Sync

### Scope

- Sync StockMovements as append-first audit records.
- Preserve existing void metadata policy.
- Recompute current quantity from pulled movements.
- Never write `Product.quantity` as stock truth.

### Dependencies

- Products sync stable.
- StockMovement append/idempotency decisions approved.

### Validation gates

- Duplicate create/retry produces one movement.
- Second device computes identical quantity.
- Pull does not execute stock commands.
- Void metadata preserves original record.
- Product records remain unchanged.

## V1-SYNC-007 - Commercial Records Sync

### Scope

- Sync Invoices, InvoiceReturns, Payments, Purchases, and Expenses.
- Apply draft revision/tombstone rules.
- Preserve issued/posted/executed/cancelled/voided audit state.
- Group invoice issue/cancel/return write sets with related StockMovements.

### Dependencies

- SYNC-006 Inventory sync.
- Immutable and cross-record atomicity policies approved.

### Validation gates

- Concurrent draft update conflict.
- Issue/cancel/return retries create no duplicate movement.
- Pull does not replay domain side effects.
- Posted/issued records reject arbitrary edits.
- If client-only atomicity cannot be proven, STOP for a trusted backend design.

## V1-SYNC-008 - Cash And Accounting Ledger Sync

### Scope

- Sync Safes, CashMovements, LedgerAccounts, and LedgerEntries.
- Preserve Safe/Ledger identity locks.
- Preserve Cash transfer/reversal and Journal reversal units.
- Recompute balances from pulled posted history.

### Dependencies

- SYNC-007 stable shared runtime.
- Append-only and multi-record atomicity policies approved.

### Validation gates

- Cash transfer/reversal remains paired and idempotent.
- Journal entries remain balanced and reversal-linked.
- No mutable Safe or LedgerAccount balance field.
- Pull changes cache/derived views only.
- Other-device balances match exactly.

## V1-SYNC-009 - Local-To-Cloud Migration Tool

### Scope

- Build backup, inventory, canonical hash, cloud preflight, dry-run,
  create/match/conflict, upload, acknowledgement, verification, and rollback
  tooling for all thirteen collections.
- Operate on TEST only and preserve all local data.

### Dependencies

- All module adapters through SYNC-008.
- Owner-approved migration plan and secure backup location.

### Validation gates

- Dry-run first, zero writes.
- No conflict before upload.
- Re-run produces MATCH, not duplicates.
- Counts, IDs, hashes, references, and derived balances match.
- No cloud/local deletes.
- Production touched: NO.

## V1-SYNC-010 - Initial Pull And Second-Device Bootstrap

### Scope

- Enable verified cloud canonical mode for migrated TEST account/modules.
- Bootstrap a clean second device.
- Install all module listeners and verify bidirectional propagation.

### Dependencies

- SYNC-009 migration verification and owner cutover approval.

### Validation gates

- Same explicit account and membership.
- All thirteen counts/hashes match.
- Inventory, cash, and ledger derived balances match.
- Reload and listener lifecycle pass.
- No side-effect replay or duplicate record.

## V1-SYNC-011 - Multi-Device Conflict / Offline / Retry Validation

### Scope

- Validate offline outbox, restart recovery, backoff, manual retry, echo
  suppression, stale revisions, immutable conflicts, logout, account switch,
  and permission revocation.

### Dependencies

- Full TEST bootstrap complete.

### Validation gates

- No silent overwrite.
- No tight retry loop.
- Failed/conflict operations remain recoverable.
- Revocation stops reads/writes.
- Financial idempotency remains intact under duplicate/reordered delivery.
- Console errors and page exceptions: 0 for accepted flows.

## V1-SYNC-012 - Sync Module Closure Audit

### Scope

- Docs-only audit of security, schema, all module adapters, migration,
  second-device behavior, offline/retry, conflict visibility, source-of-truth,
  and production isolation.

### Dependencies

- SYNC-011 accepted.

### Validation gates

- Full TEST multi-device regression.
- All thirteen repositories cloud-backed with local cache/outbox.
- No unresolved conflicts or migration discrepancy.
- TypeScript/build/runtime green.
- Production untouched.

## Global Stop Conditions

Every implementation mission stops without widening scope when it finds:

- wrong Firebase project;
- missing/ambiguous membership;
- a path account mismatch;
- an unsupported schema;
- a data conflict;
- inability to prove financial atomicity/idempotency;
- count/hash/reference mismatch;
- destructive migration requirement;
- production network or data access;
- an unapproved architecture change.
