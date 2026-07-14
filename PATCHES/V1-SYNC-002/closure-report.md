# V1-SYNC-002 Closure Report

## Mission

V1-SYNC-002 - Account-Scoped Firebase Sync Architecture and Migration Plan

## Classification

INF / Architecture / Data Safety / Sync Design

## Baseline

- Base tag: `v1-sync-001-multi-device-firebase-sync-audit`
- Branch: `v1/sync-002-account-scoped-firebase-sync-architecture-migration-plan`
- TEST target for future implementation: `abonibal-erp-test`
- Production: FROZEN / OUT OF SCOPE

## Changed Files

- `PATCHES/V1-SYNC-002/sync-architecture-contract.md`
- `PATCHES/V1-SYNC-002/firebase-rtdb-schema.md`
- `PATCHES/V1-SYNC-002/security-account-membership-plan.md`
- `PATCHES/V1-SYNC-002/conflict-idempotency-policy.md`
- `PATCHES/V1-SYNC-002/local-to-cloud-migration-plan.md`
- `PATCHES/V1-SYNC-002/implementation-roadmap.md`
- `PATCHES/V1-SYNC-002/decision-record.md`
- `PATCHES/V1-SYNC-002/closure-report.md`

Runtime source changes: NONE.

## Confirmed Current Root Cause

V1-SYNC-001 confirmed `SYNC-ROOT-A`, `SYNC-ROOT-B`, and `SYNC-ROOT-C`: all
thirteen repositories are localStorage-only, with no Firebase operational write,
pull, listener, outbox, retry path, or SyncManager.

## Recommended Architecture

- RTDB becomes canonical only after verified migration and explicit cutover.
- Local storage remains account cache, offline cache, outbox, and receipts.
- Shared SyncCoordinator and cloud adapter infrastructure serve all modules.
- Module policies retain lifecycle, reference, source-of-truth, and audit rules.
- Pull applies state to cache and never replays business commands.
- No silent last-write-wins.

## Recommended RTDB Schema

- Operational root: `accounts/{accountId}`.
- One record per stable ID under each of the thirteen module paths.
- Generic `data` plus `meta` envelope with schema version and revision.
- Account-scoped operation and migration receipts.
- No UID-rooted operational data.
- No mutable inventory, Safe, or Ledger balances.
- No destructive cloud deletes during initial rollout.

## Recommended Account Membership Model

For TEST, use an Admin-provisioned RTDB membership mirror:

`accountMembers/{accountId}/{firebaseUid}: true`

Clients cannot read/write membership directly. Rules use UID only to verify
membership in the explicit account. Long-term provisioning should be owned by a
trusted backend that validates the existing Firestore mapping and maintains the
RTDB mirror.

## Conflict And Idempotency Policy

- Mutable master data and drafts use expected revision compare-and-set.
- Conflicts are visible and require manual action.
- Issued/posted/executed records reject arbitrary edits.
- Stock, Cash, and Journal history remains append-only/audit-preserving.
- Stable operation IDs/keys and atomic receipts make retries idempotent.
- Cross-record financial effects must be one atomic write set or stop for a
  trusted backend decision.

## Offline / Outbox Policy

- Persist outbox before local cache application.
- States: pending, syncing, acknowledged, conflict, failed.
- Bounded exponential retry with no tight loop.
- Acknowledgement required before active outbox removal.
- Compact receipts retained separately without full payloads.
- Logout/account switch stops listeners and processing.

## Listener / Pull Policy

- Auth and explicit account resolution first.
- Membership preflight second.
- Per-module initial pull and revision merge.
- Module-scoped child listeners only.
- Echo suppression by operation/revision.
- No domain side-effect replay on pull.

## Migration Policy

- Secure backup and deterministic counts/hashes first.
- Cloud/membership preflight.
- Non-writing CREATE/MATCH/CONFLICT/SKIP dry run.
- Preserve IDs and references.
- Create-if-absent or exact-match acknowledgement only.
- No cloud or local deletes.
- Verify counts, IDs, hashes, references, and derived balances.
- Cut over only after owner approval.
- Bootstrap and verify a second device.

## Proposed Implementation Roadmap

1. V1-SYNC-003 - Firebase RTDB Security And Account Membership Foundation.
2. V1-SYNC-004 - Shared Firebase Sync Runtime And Outbox Foundation.
3. V1-SYNC-005 - Master Data Repository Sync.
4. V1-SYNC-006 - Inventory Ledger Sync.
5. V1-SYNC-007 - Commercial Records Sync.
6. V1-SYNC-008 - Cash And Accounting Ledger Sync.
7. V1-SYNC-009 - Local-To-Cloud Migration Tool.
8. V1-SYNC-010 - Initial Pull And Second-Device Bootstrap.
9. V1-SYNC-011 - Multi-Device Conflict / Offline / Retry Validation.
10. V1-SYNC-012 - Sync Module Closure Audit.

No roadmap implementation mission was started.

## Decisions Requiring Owner Approval

SYNC-DEC-001 through SYNC-DEC-024 are all `OWNER APPROVAL REQUIRED`. They cover
cloud ownership, schema, UID/account boundary, membership, local cache, shared
runtime, outbox, listeners, revision/conflicts, immutable and append-only data,
idempotency, no command replay, migration, verification, offline behavior,
conflict visibility, TEST-only implementation, and production deferral.

## Validation

- Baseline `git diff --check`: PASS
- TypeScript (`pnpm exec tsc --noEmit`): PASS
- Build (`pnpm run build`): PASS
- Runtime source changes: NONE
- Firebase writes: NONE
- Firebase Rules/Auth changes: NONE
- Migration executed: NO
- Deployment executed: NO
- Production touched: NO
- V1-SYNC-002 push: NOT PERFORMED

## Final Result

READY FOR ARCHITECT / OWNER DECISION
