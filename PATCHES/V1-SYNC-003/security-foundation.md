# V1-SYNC-003 Security Foundation

## Mission

V1-SYNC-003 - Firebase RTDB Security and Account Membership Foundation

Classification: Security / Firebase Foundation / TEST Only

Base tag: `v1-sync-002-account-scoped-firebase-sync-architecture-migration-plan`

Branch: `v1/sync-003-firebase-rtdb-security-account-membership-foundation`

Firebase target: `abonibal-erp-test` only

## Configuration Isolation

TEST Realtime Database rules are isolated in:

- `firebase.test.json`
- `database.test.rules.json`

The tracked production-oriented `firebase.json` and `.firebaserc` were not
modified. TEST rules deployment always requires both the dedicated config and
the explicit project ID:

```text
firebase deploy --only database --config firebase.test.json --project abonibal-erp-test
```

The dedicated config contains only the Realtime Database rules target. It does
not contain Hosting, Functions, Firestore, Storage, or Auth deployment targets.

## Membership Boundary

Operational data is rooted at:

`accounts/{accountId}/...`

Membership is mirrored by trusted administration at:

`accountMembers/{accountId}/{firebaseUid}: true`

Firebase UID is used only as the authenticated membership identity. It is not
used as `accountId` and cannot become an operational root.

An authenticated user can read an account only when the exact membership leaf
is `true`. Record creation additionally requires the same membership check.

## Initial Write Policy

V1-SYNC-003 intentionally uses a conservative create-only record policy:

- record path: `accounts/{accountId}/{module}/{recordId}`;
- the authenticated UID must be a member of the explicit logical account;
- an existing record cannot be overwritten;
- a record cannot be deleted by the client;
- payload `id` must match the record path;
- payload `accountId` must match the account path;
- `createdAt` and `createdBy` must be present as strings.

Module-specific update and lifecycle rules remain deferred. This prevents a
generic security foundation from silently overwriting issued, posted, voided,
reversed, or otherwise auditable records before approved sync adapters exist.

## Default Deny

- Root read: denied.
- Root write: denied.
- Membership read: denied to clients.
- Membership create/update/delete: denied to clients.
- Unknown root paths: denied.
- Cross-account access: denied unless a separate trusted membership exists.
- Unauthenticated access: denied.

## Scope Exclusions

- No repository changes.
- No runtime Firebase Database client.
- No SyncCoordinator or outbox.
- No localStorage migration or deletion.
- No operational data migration.
- No writes to any of the 13 operational collections.
- No Hosting, Functions, Firestore, Storage, or Auth deployment.
- No production Firebase command.
