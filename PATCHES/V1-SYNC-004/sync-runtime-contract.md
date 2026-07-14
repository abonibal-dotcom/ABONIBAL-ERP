# V1-SYNC-004 - Shared Sync Runtime Contract

## Mission Boundary

V1-SYNC-004 provides shared synchronization infrastructure only. It does not connect any of the 13 operational repositories, migrate data, make Firebase canonical, start operational listeners, or write operational records to Firebase Realtime Database.

Firebase implementation target for later missions is `abonibal-erp-test`. Production remains frozen and was not touched.

## Sync Modes

| Mode | Contract |
| --- | --- |
| `disabled` | Default. Local outbox administration is allowed; cloud processing and listeners are blocked. |
| `migration` | Requires explicit owner approval and a non-empty migration ID. Reserved for a controlled migration workflow. |
| `active` | Requires owner approval, verified migration, explicit cutover approval, and an approval reference. |

`DEFAULT_SYNC_MODE` is `disabled`. `Container` registers the foundation but does not call `SyncCoordinator.start()` and does not activate migration or active mode.

## Firebase Realtime Client

`FirebaseRealtimeClient` uses the existing modular Firebase SDK and a lazy database provider. Its public contract is limited to:

- `read(path)`
- `readCollection(path)`
- `createIfAbsent(path, value)` using a transaction
- `compareAndSet(path, expectedRevision, nextValue)` using a transaction and a sequential revision check
- `subscribe(path, callback)` returning an unsubscribe function
- `subscribeConnectivity(callback)`
- normalized safe errors

There is no public blind overwrite method and no destructive delete method. No operational path is passed to this client in V1-SYNC-004.

## Operation Contract

`SyncOperation` records:

- stable operation, account, module, and record identities
- operation type: `create`, `update`, `append`, `void`, or `reverse`
- optional expected revision and write-set checksum
- idempotency key
- safe inline payload or safe payload reference
- timestamps, retry metadata, safe error details, and status

Hard delete is intentionally absent. Supported modules are the 13 accepted account-scoped data groups, but none is wired to enqueue operations in this mission.

## Coordinator Contract

`SyncCoordinator` owns explicit lifecycle control:

- `start`, `stop`, `pause`, and `resume`
- `processNext` and bounded `processPending`
- retry classification and scheduling
- receipt-first acknowledgement finalization
- conflict persistence
- interrupted-operation recovery
- logout and account-switch cleanup
- safe status reporting

The coordinator resolves only the authenticated logical `account.id` and requires it to match `session.user.accountId`. The provider user identity is not accepted as an operational account ID and there is no fallback account.

When disabled, processing returns without invoking the transport. The registered transport is `UnconfiguredSyncOperationTransport`, so the foundation has no operational Firebase adapter even if a caller attempts to enable processing prematurely.

## Crash and Acknowledgement Safety

An acknowledgement is finalized in this order:

1. Persist the local receipt.
2. Verify that the receipt can be read back.
3. Mark the active outbox operation acknowledged.
4. Remove only the acknowledged operation from the active outbox.

If a crash occurs after receipt persistence, restart recovery recognizes the receipt and finalizes the local outbox without replaying the cloud operation. Interrupted `syncing` entries without receipts return to explicit `pending` state.

## Pull and Echo Boundary

`SyncEchoPolicy` compares operation ID, idempotency key, revision, and local receipt to suppress a local cloud echo.

`SyncCacheWriter` is a deliberate type boundary: applying a remote authoritative record may update validated cache/state only. It must never invoke business commands such as invoice issue, inventory movement creation, expense posting, cash posting, or journal posting. No cache writer implementation is attached to an operational repository in this mission.

## Listener Boundary

`ListenerCoordinator` can register, replace, remove, and clear unsubscribe callbacks. Logout, account switch, offline transition, pause, stop, and disposal clear registered listeners. No listener for any operational module is registered in V1-SYNC-004.

## Container Registrations

The following foundation objects are registered:

- `syncOutboxRepository`
- `syncReceiptRepository`
- `syncConflictRepository`
- `syncModeService`
- `syncStatusService`
- `syncRetryPolicy`
- `syncListenerCoordinator`
- `syncEchoPolicy`
- `firebaseRealtimeClient`
- `syncOperationTransport`
- `syncCoordinator`

Existing operational repository and service registrations remain unchanged.
