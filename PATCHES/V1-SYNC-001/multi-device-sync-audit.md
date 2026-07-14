# V1-SYNC-001 Multi-Device Sync Audit

## Mission

- Classification: INF / Blocking Runtime Data Boundary Audit
- Base: `v1-fix-001-preview-product-invoice-ledger-blockers`
- Branch: `v1/sync-001-multi-device-firebase-persistence-sync-audit`
- Audit date: 2026-07-14
- Trigger: records created on the TEST live site on a laptop were absent on a
  phone using the same TEST live URL.

This audit was read-only with respect to runtime data and application source.
No local storage was cleared, no TEST record was changed, no Firebase rule or
Auth setting was changed, and no deployment was performed.

## Methods

1. Inspected the Auth session and account-mapping path.
2. Inspected the core persistence abstractions and Container wiring.
3. Inspected all thirteen operational repository and persistence-key pairs.
4. Searched application source for Realtime Database APIs, cloud read/write
   paths, `SyncManager`, manual sync, pull, and push implementations.
5. Performed a shallow, read-only Firebase CLI query against `/` in
   `abonibal-erp-test`; only path counts and expected path presence were
   evaluated.
6. Read TEST rule metadata without printing rule content or user identifiers.
7. Ran `git diff --check`, TypeScript, and the production build.

No record content, UID, raw `accountId`, token, credential, SDK configuration,
or `.env` value was printed or stored in mission evidence.

## Auth And Account Context

### Session construction

The application initializes Firebase Auth and restores the current Firebase
user through `authStateReady()`. The Firebase identity is passed to
`DefaultAuthSessionResolver`, which uses `FirebaseAccountMappingSource` to read
the Firestore mapping at:

`accountMappings/firebase/providerUsers/{providerUserId}`

The mapping supplies the explicit application `accountId`, application user
identity, account name, display name, and role. A missing mapping fails closed.
The mapping parser also rejects an `accountId` equal to the Firebase provider
user id.

### Stability across devices

- Account source: Firestore account mapping, not browser local storage.
- Per-device account fallback: NONE.
- Locally generated account id: NONE.
- Firebase UID used as account id: NO; equality is explicitly rejected.
- Auth context stored as operational data in local storage: NO.
- Same Firebase user with the same mapping resolves logically to the same
  `accountId` on every device: YES.
- Runtime fingerprint comparison between the owner's two devices: NOT
  COLLECTED. It is not needed to establish the current storage failure because
  no operational repository has a cloud path.

The `AuthStateService` keeps the resolved session in application memory. On a
reload, Firebase restores its Auth user and the account mapping is resolved
again from Firestore. There is no code path that creates a different account
context for each browser.

A source diagnostic widget was not added. The audit remained docs-only because
the persistence root cause is conclusive from repository wiring and the empty
TEST database. A later implementation may expose only `ACTIVE/INACTIVE`,
`RESOLVED/NOT RESOLVED`, a one-way short account fingerprint, and `TEST` as a
support diagnostic.

## Operational Storage Boundary

`Container.boot()` creates one `LocalStorageDriver` and passes that driver to
every operational repository. `Driver.read()` and `Driver.write()` are
synchronous, and `LocalStorageDriver` implements them with
`localStorage.getItem()` and `localStorage.setItem()`.

The accepted scoped names such as `products:{accountId}` and
`invoices:{accountId}` are browser local-storage keys. They are not Firebase
paths and have no cloud mapping in the current application.

The Product repository retains a controlled legacy browser key named
`products` for legacy import/backup handling. Normal Product reads and writes
use `products:{accountId}`. Neither form is synchronized to Firebase.

## Sync Capability

- Firebase Realtime Database initialization: ABSENT.
- `firebase/database` import in application source: ABSENT.
- `getDatabase`, `ref`, `set`, `update`, `onValue`, or transaction usage:
  ABSENT.
- `VITE_FIREBASE_DATABASE_URL` consumption by application config: ABSENT.
- Firebase cloud write path for operational modules: ABSENT.
- Firebase cloud initial pull/read path: ABSENT.
- Realtime listener: ABSENT.
- `SyncManager`: ABSENT.
- `manualSync`, `pullFromCloud`, or `pushToCloud`: ABSENT.
- Outbox, acknowledgement, retry, or conflict-resolution layer: ABSENT.

The installed Firebase package includes the Database SDK transitively, but the
application does not import or initialize it. Package availability is not a
sync implementation.

## Owner Observation

The reported behavior is the expected result of this architecture:

1. The laptop writes each record to its own browser local storage.
2. No corresponding Firebase write is attempted.
3. The phone opens with an independent browser local storage database.
4. No Firebase pull or realtime listener populates the phone.
5. The phone therefore cannot display the laptop's records.

The same URL, successful Firebase login, and a stable account mapping do not
make browser local storage shared between devices.

## Validation

- `git diff --check`: PASS before documentation
- `pnpm exec tsc --noEmit`: PASS
- `pnpm run build`: PASS
- TEST RTDB shallow read: PASS
- Source changes: NONE
- Runtime data writes: NONE
- Firebase deployment: NONE
- Production touched: NO
