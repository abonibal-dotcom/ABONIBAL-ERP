# V1-SYNC-005 Security Rules Evolution

## Target Isolation

- Firebase target: `abonibal-erp-test`
- Config: `firebase.test.json`
- Rules: `database.test.rules.json`
- Production: frozen and untouched
- Hosting deployment: none
- Operational TEST data writes: 0

The TEST config contains only the Realtime Database rules target and an
explicit local Database Emulator port. Deployment required both the dedicated
config and explicit TEST project ID.

## Rule Contract

The rules retain default deny and immutable client membership. Access to
`accounts/{accountId}` requires an authenticated UID with an explicit true
membership at `accountMembers/{accountId}/{uid}`. UID is used only in that
membership check.

Only `products`, `customers`, and `suppliers` record paths are writable. Record
rules enforce:

- path `recordId` equals `data.id`
- path `accountId` equals `data.accountId`
- create revision is 1
- update revision is current revision plus 1
- immutable ID, account, creator, and creation timestamp
- valid schema/revision/timestamp/operation/tombstone/checksum metadata
- physical delete denied

Operation receipts are create-only, member-only, and validated for operation,
module, record, revision, checksum, idempotency, state, and server timestamp.
The runtime transport writes record and receipt atomically. RTDB child rules
validate both proposed children independently because a child rule cannot use
`root` as a proposed sibling snapshot.

## Emulator Results

The tracked rules were loaded into the RTDB Emulator with synthetic identities
and no owner data. Results were 36/36 PASS.

| Gate | Products | Customers | Suppliers |
| --- | --- | --- | --- |
| Own-account create | PASS | PASS | PASS |
| Own-account read | PASS | PASS | PASS |
| Valid revision update | PASS | PASS | PASS |
| Stale revision update | DENIED | DENIED | DENIED |
| Blind payload overwrite | DENIED | DENIED | DENIED |
| Physical delete | DENIED | DENIED | DENIED |
| Foreign-account read | DENIED | DENIED | DENIED |
| Foreign-account write | DENIED | DENIED | DENIED |
| Unauthenticated read | DENIED | DENIED | DENIED |
| Unauthenticated write | DENIED | DENIED | DENIED |
| Membership mutation | DENIED | DENIED | DENIED |

Client membership create, update, and delete were each separately denied.

## Deployment

After Emulator PASS, only TEST Realtime Database rules were deployed:

```text
firebase deploy --only database --config firebase.test.json --project abonibal-erp-test
```

Result: PASS. The deployed TEST rules were fetched into a temporary file,
normalized, compared to the tracked file, and the temporary file was removed.
Deployed and tracked rules match.

No Hosting, Functions, Storage, Firestore, Auth, or production deployment was
performed.
