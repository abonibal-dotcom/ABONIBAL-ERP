# V1-SYNC-002 Security And Account Membership Plan

## Problem

The application currently resolves the explicit ERP `accountId` from a
Firestore document keyed by Firebase provider user ID. RTDB Security Rules
cannot read that Firestore mapping while evaluating an RTDB request.

Using `auth.uid` as the operational `accountId` would violate the accepted data
boundary and is rejected.

## Security Objectives

1. A signed-in user can access only explicitly assigned ERP accounts.
2. A client cannot grant itself membership.
3. A record cannot escape its path account boundary.
4. Missing or stale membership fails closed.
5. Revocation is enforceable without rewriting business records.
6. Rules do not depend on client-provided account claims inside a payload.
7. TEST and production membership are completely separate.

## Recommended TEST Model

Use an RTDB membership mirror provisioned only by trusted administration:

`accountMembers/{accountId}/{firebaseUid}: true`

Then protect `accounts/{accountId}` conceptually with:

```text
auth != null
AND
root.child('accountMembers')
    .child($accountId)
    .child(auth.uid)
    .val() === true
```

The Firebase UID is used only to ask whether an authenticated identity belongs
to the explicit account. It is not the account ID and is not stored as the
operational data root.

## Membership Path Policy

- Client `.write`: DENY for the entire `accountMembers` tree.
- Client `.read`: DENY by default; rules may inspect the tree internally.
- Provisioning: trusted Admin SDK, controlled Firebase administration, or a
  future backend service only.
- Membership creation, revocation, and repair: auditable administrative action.
- Client account creation: NOT ALLOWED.
- Client membership invitation: NOT INCLUDED in V1.

An authenticated client must not be able to write a `true` value at its own UID
under another account.

## Operational Record Validation

At every `accounts/{accountId}/{module}/{recordId}` path, rules and application
validation must require:

1. Authenticated membership for `$accountId`.
2. `newData.data.accountId === $accountId`.
3. `newData.data.id === $recordId`.
4. Existing `id`, `accountId`, and `createdAt/createdBy` are immutable.
5. Revision follows the create/update contract.
6. Module and lifecycle validation passes.
7. Deletes are denied unless a future separately approved rule explicitly
   permits them; initial V1 policy denies them.

Rules are a security boundary, not the only domain validator. Services and
cloud adapters must validate the same invariants before enqueueing.

## Provisioning Flow For TEST

1. Owner approves the existing Firestore mapping.
2. A trusted operator resolves the Firebase Auth identity and explicit ERP
   `accountId` without exposing either in mission evidence.
3. Trusted administration writes the membership boolean in
   `abonibal-erp-test` only.
4. A read-only verification confirms the membership exists.
5. Authorized canary read/write is tested against a non-operational TEST path.
6. Unauthorized account access and self-membership writes are confirmed denied.
7. Only then may an operational module sync mission begin.

No step may use the tracked Firebase default project. Every CLI command must
include `--project abonibal-erp-test` and verify the target before execution.

## Options Compared

| Option | Strengths | Risks / limitations | Recommendation |
| --- | --- | --- | --- |
| RTDB membership mirror | Directly readable by RTDB Rules, immediate revocation, supports multiple accounts | Requires trusted provisioning and consistency with Firestore | Best enforcement primitive for TEST now |
| Firebase Custom Claims | Signed by Auth, rules-friendly, client cannot forge | Token refresh delay, claim size limits, administrative backend required, awkward multi-account updates | Optional future optimization, not primary V1 source |
| Dedicated backend/admin provisioning | Central audit, validates Firestore mapping and membership together | Adds backend deployment and operational ownership | Best long-term provisioning authority |

## Recommended Long-Term Model

Keep RTDB membership as the rules enforcement data, but maintain it through a
trusted provisioning service that validates the authoritative Firestore account
mapping and writes the RTDB mirror. The service should:

- create/revoke membership idempotently;
- log actor, reason, and timestamp;
- detect mapping/membership drift;
- never expose Admin credentials to the browser;
- support future role policy without changing `accountId` semantics.

Custom claims may cache coarse authorization later, but should not be the only
source for dynamic membership because revocation can remain stale until token
refresh.

## Firestore And RTDB Consistency

Firestore remains the current Auth session resolution source. RTDB membership
is a security mirror, not a second account identity resolver. Login must fail or
sync must stay disabled when:

- Firestore mapping is missing or invalid;
- resolved `accountId` differs from the user session account;
- RTDB membership is absent;
- Firebase projects do not match the approved TEST target.

The system must never search for another account, generate one locally, or fall
back to the Firebase UID.

## Role Boundary

The initial boolean membership grants account data access only. Existing
application roles remain sourced from the Firestore mapping and enforced by
approved application behavior. Fine-grained RTDB role rules are deferred until
the owner approves an expanded authorization model.

If future rules need role enforcement, the membership value may become a
trusted object such as `{ active, role }`, but that is not part of this initial
contract.

## Revocation

1. Trusted provisioning removes or disables the RTDB membership.
2. New reads and writes fail immediately under RTDB Rules.
3. Active listeners receive permission failure and the coordinator stops.
4. Pending outbox entries remain local and blocked; they are not redirected.
5. Local account cache is not silently deleted.
6. Reauthorization requires an explicit owner action.

## Required V1-SYNC-003 Evidence

- TEST project identity proof.
- Membership created only by trusted administration.
- Authorized account access: PASS.
- Other-account access: DENIED.
- Self-grant attempt: DENIED.
- Unauthenticated access: DENIED.
- Record `accountId` mismatch: DENIED.
- Delete attempt: DENIED.
- Production touched: NO.

No rules or membership data were changed in V1-SYNC-002.
