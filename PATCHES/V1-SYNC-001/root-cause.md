# V1-SYNC-001 Root Cause

## Confirmed Classification

### SYNC-ROOT-A: Repositories are localStorage-only

CONFIRMED. All thirteen operational repositories receive
`LocalStorageDriver`. Each accepted account-scoped key is a key in the current
browser, not a cloud collection or path.

### SYNC-ROOT-B: Firebase write path missing

CONFIRMED. There is no Realtime Database initialization, repository adapter,
write call, acknowledgement, retry, or outbox. TEST RTDB remained empty after
the owner's laptop QA work.

### SYNC-ROOT-C: Firebase pull/read path missing

CONFIRMED. There is no startup pull, page read, realtime listener, or manual
sync path. The phone can read only its own browser local storage.

## Classifications Not Supported As Current Causes

- SYNC-ROOT-D, different account id across devices: NOT SUPPORTED. The same
  Firebase user resolves the same explicit Firestore account mapping, and no
  device-local account fallback exists. A runtime fingerprint comparison was
  not collected, but account divergence is not needed to explain the failure.
- SYNC-ROOT-E, Firebase Rules deny access: NOT THE CURRENT CAUSE. Rules are
  Auth-gated, but no Database operation is attempted.
- SYNC-ROOT-F, SyncManager excludes new modules: NOT APPLICABLE. There is no
  `SyncManager` in current source, old or new.
- SYNC-ROOT-G, writes fail silently: NOT THE CURRENT CAUSE. Cloud writes are
  absent; they are not invoked and then swallowed.
- SYNC-ROOT-H: no additional current runtime cause is needed. A future
  architecture decision is required for explicit-account authorization in
  RTDB Rules, but that is an implementation prerequisite rather than the cause
  of today's missing data.

## Causal Chain

`service -> account-scoped repository -> LocalStorageDriver -> browser-local array`

There is no following cloud step. Laptop and phone therefore have isolated
arrays even when they authenticate to the same application account.

## Non-Destructive Repair Plan

The repair should be split into an approved design mission and narrow
implementation missions. A single fire-and-forget double write would risk data
loss, duplicates, stale overwrites, and financial audit corruption.

### Phase 1: Approve the cloud contract

Define and approve:

1. Canonical account-scoped RTDB path shape and schema version.
2. Authorization bridge between Firebase Auth and the explicit `accountId`.
3. Cloud-authoritative versus cache behavior.
4. Initial-load, realtime-listener, offline, retry, and conflict policy.
5. Record-level write strategy that avoids whole-array last-writer-wins loss.
6. Idempotency and concurrency rules for posted, voided, cancelled, and
   reversed financial records.
7. Non-destructive local import and rollback policy.

Recommended next mission:

`V1-SYNC-002 - Account-Scoped Firebase Sync Architecture and Migration Plan`

### Phase 2: Add shared sync infrastructure

After approval:

1. Extend Firebase runtime config to consume the TEST Database URL safely.
2. Initialize a Realtime Database client for the selected project.
3. Add an asynchronous account-scoped cloud persistence contract.
4. Add a local cache/outbox coordinator with server acknowledgement and retry.
5. Subscribe to account-scoped cloud changes and merge by stable record id.
6. Surface write failures; never treat an unacknowledged cloud write as synced.
7. Add sanitized support diagnostics without raw identifiers.

### Phase 3: Migrate module repositories deliberately

Move modules behind the shared contract in controlled batches. Validate
master-data modules first, then inventory and Sales, then the financial audit
ledgers. Each batch must preserve account isolation, record ids, timestamps,
status history, reference links, and idempotency keys.

### Phase 4: Import existing laptop-local TEST data

A migration is required for the owner's current laptop QA records because they
exist only in that browser. It must be non-destructive and idempotent:

1. Inventory local records by scoped key without exposing payloads.
2. Create a local backup and a count/hash preview.
3. Confirm the target TEST account and approved cloud path.
4. Upsert by stable record id; never append blindly.
5. Preserve references and import dependency order.
6. Wait for server acknowledgement and verify counts/hashes.
7. Mark each imported record/batch only after acknowledgement.
8. Keep local data intact as cache and rollback evidence.
9. Re-running the migration must create no duplicates.

No migration should run against production, and no TEST import should copy data
from production.

## Expected Repair Surface

The exact list depends on the approved Phase 1 contract. The likely repair
surface is:

- `src/modules/auth/firebase/FirebaseAuthConfig.ts` or a new Firebase runtime
  config module.
- `src/modules/auth/firebase/FirebaseAuthClient.ts` or a separate Database
  client module.
- `src/core/persistence/Driver.ts` and/or a new asynchronous cloud persistence
  contract.
- `src/core/persistence/LocalStorageDriver.ts` as the cache implementation,
  without deleting current data.
- A new account-scoped Firebase repository/driver and sync coordinator.
- `src/core/Container.ts`.
- The thirteen repository classes and their cloud path helpers, or a shared
  repository base adopted by those classes.
- Auth-to-account authorization support selected by the owner.
- TEST Realtime Database Rules in a separate approved rules mission.
- Migration tooling, tests, runtime evidence, and rollback documentation.

Services and pages should change only where asynchronous loading/error states
cannot be hidden safely behind the approved repository contract.

## Repair Gate

Implementation must not begin until the owner approves the RTDB authorization,
conflict-resolution, and local-data migration contracts. The current audit does
not invent those financial and security rules.
