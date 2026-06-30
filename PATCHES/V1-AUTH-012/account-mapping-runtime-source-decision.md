# V1-AUTH-012 Account Mapping Runtime Source Decision

## Status

Recommendation ready for Architect / Owner review.

This document records an engineering recommendation. It is not a source-code implementation and does not update `DECISIONS.md` as an owner-approved final decision.

## Confirmed Problem

V1-AUTH-010 created the `AccountMappingSource` contract.

V1-AUTH-011 created the minimal Login / Logout flow.

Login cannot create an authenticated ABONIBAL ERP `AuthSession` unless Firebase provider identity resolves into explicit project account data.

The unresolved question is where the runtime mapping comes from:

- `accountId`
- `accountName`
- `role`
- user profile fields

## Why Route Guard Must Wait

Route Guard would make Dashboard, Products, and future business routes depend on authenticated app state.

Authenticated app state is not safe until a Firebase user resolves through an approved account mapping source.

If Route Guard is implemented before mapping source implementation and verification, the app risks one of the following unsafe outcomes:

- Blocking legitimate users because account mapping is missing.
- Accidentally authenticating users into the wrong account.
- Treating Firebase uid as `accountId`.
- Defaulting users to `owner`.
- Hiding mapping failures behind route redirects.

Therefore Route Guard must wait until:

1. The runtime mapping source is approved.
2. The mapping source is implemented.
3. Authenticated session runtime verification proves successful and missing mapping behavior.

## Options Evaluated

### Option A - Firebase Custom Claims

Mapping fields such as accountId and role come from Firebase token/custom claims.

Pros:

- Close to Auth provider.
- Efficient after sign-in.
- Useful for identity-related authorization metadata.

Cons:

- Requires secure admin-side claim management.
- Claim updates may not be instant.
- Requires backend/admin tooling not yet established.
- Not enough by itself for account display/profile data.

Assessment:

Useful later for optimization or stronger authorization, but not recommended as the only V1 runtime mapping source unless backend/admin tooling is approved.

### Option B - Firebase Database Account Mapping

Mapping lives in a Firebase-backed data source keyed by provider identity.

Example conceptual path:

```text
accountUsers/{provider}/providerUsers/{providerUserId}
```

or another approved structure.

Pros:

- Explicit account mapping source.
- Can include accountId, accountName, userId, displayName, role, and email.
- Fits future Firebase-backed sync direction.
- Avoids assuming providerUserId equals accountId.
- Easier to update than token claims.

Cons:

- Requires database security rules later.
- Requires runtime database read.
- Requires approved test environment and mapping data.
- Must avoid hardcoded mappings.

Assessment:

Recommended V1 runtime source, pending Architect / Owner approval.

### Option C - Local Development Mapping

Mapping is local-only for development or testing.

Pros:

- Fast for local verification.

Cons:

- Not production-safe.
- Risky if confused with the real account boundary.
- Must not become official V1 runtime mapping.

Assessment:

May be useful only as explicitly isolated test scaffolding in future verification work. Rejected as the official V1 runtime source.

### Option D - Hardcoded / Default Mapping

Examples:

- `providerUserId` equals `accountId`.
- Every user becomes `owner`.
- One global account.

Assessment:

Rejected for V1.

This violates the approved account boundary and can create unsafe authorization behavior.

## Recommended V1 Mapping Source

Use a Firebase-backed account mapping source for V1, pending Architect / Owner approval.

The implementation should satisfy the existing `AccountMappingSource` contract and return explicit account/user mapping data after Firebase sign-in.

## Rejected Options

Rejected as official V1 runtime source:

- Hardcoded/default mapping.
- `providerUserId === accountId`.
- Default owner fallback.
- One global account.
- Local-only mapping.
- Silent success when mapping is missing.

Deferred or conditional:

- Firebase custom claims as the only V1 source, unless backend/admin tooling is approved.

## Required Data Fields

The runtime mapping source must explicitly return:

```text
provider
providerUserId
accountId
accountName
userId
displayName
role
```

Optional:

```text
email
```

Rules:

- `providerUserId` is not `accountId`.
- `accountId` must be explicit.
- `accountName` must be explicit.
- `role` must be explicit.
- Role must remain one of the V1 roles: `owner` or `user`.
- No default owner fallback.
- Missing mapping must fail safely.

## Required Security / Rules Considerations

Before Route Guard, the Firebase-backed mapping implementation must define and verify security expectations:

- Users may only read their own provider-user mapping unless an approved admin model exists.
- Mapping writes must not be possible from ordinary client users.
- Account and role fields must not be client-editable by the signed-in user.
- Missing mapping must produce unauthenticated app state, not partial authenticated state.
- Mapping read failures must surface safely and must not silently authenticate.
- No production account mappings may be hardcoded in client source.
- No real credentials may be committed.

## Required Runtime Verification Before Route Guard

Before Route Guard implementation, runtime verification must prove:

- Firebase sign-in with approved test credentials can resolve mapping.
- Resolved AuthSession contains explicit `accountId`.
- Resolved AuthSession contains explicit `accountName`.
- Resolved AuthSession contains explicit `role`.
- Firebase uid is stored only as provider identity, not as `accountId`.
- Missing mapping fails safely and leaves AuthState unauthenticated.
- No default owner fallback occurs.
- Login failure messages remain safe.
- Password is not stored in localStorage.
- Dashboard and Products route behavior remains unchanged until Route Guard mission.
- Console errors = 0.
- Page exceptions = 0.

## Future Implementation Sequence

Recommended sequence after Architect / Owner approval:

1. `V1-AUTH-013 - Firebase Account Mapping Source Implementation`
2. `V1-AUTH-014 - Authenticated Session Runtime Verification`
3. `V1-AUTH-015 - Route Guard Foundation`
4. `V1-AUTH-016 - Protected Route Runtime Verification`
5. `V1-AUTH-017 - Legacy Storage Compatibility Plan`
6. `V1-AUTH-018 - Account-scoped Persistence Planning`

## Scope Confirmation

- No source files changed.
- No account mapping source implemented.
- No Firebase Database or Firestore dependency added.
- No package or lockfile changes.
- No route guard added.
- No Product files changed.
- No persistence files changed.
- No localStorage migration performed.
- No real mappings or seeded accounts added.
- No real credentials committed.
- ECS-006 remains blocked.
