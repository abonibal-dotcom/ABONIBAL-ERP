# V1-SYNC-002 Local-To-Cloud Migration Plan

## Objective

Move the owner's existing account-scoped TEST data from the laptop cache to
`abonibal-erp-test` without clearing local data, changing IDs, duplicating
records, deleting cloud data, overwriting conflicts, or using Firebase UID as
`accountId`.

This document is a plan only. No backup, read of local business payloads,
migration, Firebase write, or cutover occurred in V1-SYNC-002.

## Prerequisites

Migration remains disabled until:

1. SYNC-DEC-001 through SYNC-DEC-024 are owner-approved.
2. TEST rules and trusted account membership pass V1-SYNC-003.
3. Shared sync runtime and all required module adapters pass validation.
4. The authenticated session resolves the expected explicit account.
5. The Firebase project is exactly `abonibal-erp-test`.
6. Production and Wakalat-AlFares are excluded by a fail-closed target gate.
7. The owner has a secure local backup destination outside Git.

## Phase 0 - Backup And Inventory

Create a local encrypted or otherwise owner-secured export outside the
repository. It includes:

- export format/schema version;
- explicit account ID inside the protected backup only;
- export timestamp;
- all thirteen scoped collection payloads;
- count per collection;
- stable IDs sorted per collection;
- deterministic canonical SHA-256 per collection and entire export;
- unresolved reference warnings;
- no Auth tokens, passwords, SDK configuration, or `.env` values.

Do not clear or mutate local storage. A failed backup blocks migration.

Canonical hashing must normalize object-key order, sort records by stable ID,
normalize Date values to UTC ISO strings, and reject non-finite/unsupported
values. The canonical representation must be documented and tested.

## Phase 1 - Cloud Preflight

1. Verify Firebase Auth is active.
2. Resolve the explicit account through the accepted Firestore mapping.
3. Verify RTDB membership for the same account.
4. Verify TEST project identity and Database URL without printing configuration.
5. Read cloud schema version and collection counts.
6. Verify no record is outside `accounts/{accountId}`.
7. Detect non-empty cloud collections.
8. Stop on unexpected records, another account path, unsupported schema, or
   permission failure.

The expected initial TEST state from V1-SYNC-001 was empty, but migration must
recheck it at execution time. Old evidence is not a write authorization.

## Phase 2 - Dry Run

For each local record, produce a non-writing result:

| Result | Meaning | Action |
| --- | --- | --- |
| CREATE | Stable ID absent in cloud | Eligible for idempotent create |
| MATCH | Same ID and canonical domain checksum | Acknowledge/skip |
| CONFLICT | Same ID with different canonical content | Stop that record; no overwrite |
| SKIP | Record intentionally excluded by approved rule | Record reason; do not write |

Dry run also validates:

- RTDB-safe IDs;
- account IDs;
- schema and field types;
- lifecycle status;
- reference IDs;
- idempotency keys;
- product Date normalization;
- Product image payload size/type;
- derived ledger invariants.

Any conflict or invalid financial record blocks cutover. No automated merge is
allowed.

## Dependency Order

Recommended upload order:

1. Products, Customers, Suppliers.
2. Safes and LedgerAccounts.
3. StockMovements.
4. Invoices, then InvoiceReturns.
5. Payments, Purchases, Expenses.
6. CashMovements after Safes.
7. LedgerEntries after LedgerAccounts.

Snapshots permit historical records to survive missing/deleted master records,
but every missing reference must be classified rather than silently repaired.

## Phase 3 - Idempotent Upload

Upload one approved migration batch with a stable `migrationId`.

For each record:

1. Use its existing ID as the RTDB key.
2. Create only if absent.
3. If identical, record MATCH and do not rewrite.
4. If different, record CONFLICT and do not overwrite.
5. Set initial cloud revision to `1` for newly created records.
6. Preserve domain timestamps, actors, status, references, and snapshots.
7. Use a server sync timestamp only in envelope metadata.
8. Write no tombstone or delete operation unless the dry-run policy explicitly
   identified an existing local safe-delete/draft tombstone state.
9. Never delete any cloud or local record.

Financial write sets and linked records must preserve existing IDs. Migration
does not replay issue, post, return, transfer, or reversal commands.

## Phase 4 - Per-Record Acknowledgement

The migration receipt records:

- migration ID;
- module and local stable ID;
- target path;
- CREATE/MATCH/CONFLICT/SKIP result;
- cloud revision;
- canonical domain checksum;
- acknowledgement timestamp;
- safe error code when blocked.

Receipts must not duplicate full business payloads. A local migration record is
marked complete only after cloud acknowledgement is read and validated.

## Phase 5 - Verification

Compare local backup, cloud, and a fresh pull:

1. Collection counts.
2. Stable ID sets.
3. Canonical per-record and per-collection hashes.
4. Reference integrity.
5. Lifecycle statuses and audit metadata.
6. Inventory quantity per Product from non-voided StockMovements.
7. Safe balance per Safe from posted/reversal CashMovements.
8. Ledger current and dated balances from posted/reversal JournalEntries.
9. Invoice deduction, cancellation, and return movement traceability.
10. Cash transfer pairing and reversal traceability.
11. Journal balance and reversal links.

Any mismatch blocks cutover. Do not fix mismatches by deleting either side.

## Phase 6 - Cutover

Cutover is explicit and account/module scoped:

1. Owner reviews migration report and zero-conflict result.
2. A fresh local backup is retained.
3. Cloud canonical mode is enabled for the migrated account/modules.
4. Local records remain as cache and rollback evidence.
5. Outbox and listeners start from acknowledged cloud revisions.
6. UI exposes active/offline/conflict state.
7. Existing local IDs continue unchanged.

No production cutover is part of this sequence.

## Phase 7 - Second-Device Bootstrap

On the phone or another clean TEST device:

1. Sign in with the approved TEST user.
2. Resolve the same explicit account.
3. Verify RTDB membership.
4. Start from an empty account-scoped local cache.
5. Pull each module from cloud.
6. Validate envelopes and populate cache without domain command replay.
7. Compare counts, IDs, hashes, and derived balances with the migration report.
8. Verify reload and realtime propagation in both directions.

Owner device validation is required before the migration mission closes.

## Failure And Rollback Strategy

### Before cutover

- Keep current local data canonical.
- Stop uploader and listeners.
- Preserve backup, outbox, receipts, and cloud records already created.
- Mark the migration batch incomplete.
- Do not delete partial cloud records.
- Re-run dry run: matching records become MATCH; differing records become
  CONFLICT.

### After cutover but before closure

- Pause new sync writes through an approved kill switch.
- Export current cloud state and pending local outbox.
- Preserve all local caches.
- Return the affected module/account to a documented read-only recovery mode.
- Do not roll back by clearing RTDB or local storage.
- Resume only after count/hash/reference reconciliation.

### Security or wrong-target failure

Stop immediately. No retry, fallback, project switch, or alternate account is
allowed. Confirm production remained untouched before any continuation.

## Migration Evidence Package

The future migration mission must produce sanitized evidence containing:

- target project and account fingerprint;
- backup created result;
- counts and hashes, not record payloads;
- dry-run classification totals;
- create/match/conflict/skip totals;
- acknowledgement totals;
- reference and derived-balance results;
- second-device bootstrap result;
- console/network/page exception counts;
- production touched: NO.

Business backup payloads remain outside Git, `PATCHES`, and `outputs` unless the
owner approves a secure evidence location.
