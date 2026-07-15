# V1-SYNC-006 Append-Only Security Rules

## TEST Rule Boundary

The TEST-only RTDB rules add `stockMovements` beneath:

`accounts/$accountId/stockMovements/$movementId`

Access requires Firebase authentication and explicit membership at:

`accountMembers/$accountId/$firebaseUid == true`

The Firebase UID participates only in membership authorization. It is never used as the operational `accountId`.

## Write Policy

- Create is allowed only when the movement path does not exist.
- Record `accountId` must match `$accountId`.
- Record `id` must match `$movementId`.
- Required immutable ledger and envelope fields must be present.
- Ledger semantics version must be 2.
- Envelope schema and revision must be 1.
- Envelope immutable marker must be `true`.
- Update, identical overwrite, and physical delete are denied.
- Unknown operational modules are denied.
- Membership creation, update, and deletion by the client are denied.

Complex domain invariants such as exact reversal effect and one logical reversal remain application/transport responsibilities; the rules do not claim to prove them.

## Emulator Evidence

`scripts/v1-sync-006-rules-smoke.ts` passed `17/17`:

- Own-account create and read: PASS.
- Existing update and blind overwrite: DENIED.
- Physical delete: DENIED.
- Foreign read/create/overwrite: DENIED.
- Unauthenticated read/write: DENIED.
- Account and movement path mismatch: DENIED.
- Invalid schema and unknown module: DENIED.
- Membership create/update/delete: DENIED.

The existing V1-SYNC-005 master-data rules regression passed `36/36`.

## Deployment Evidence

Only TEST Realtime Database rules were deployed, using the explicit safe command shape:

```text
firebase deploy --only database --config firebase.test.json --project abonibal-erp-test
```

Result: PASS. Hosting, Functions, Storage, Firestore, Auth, and production were not deployed or modified.
