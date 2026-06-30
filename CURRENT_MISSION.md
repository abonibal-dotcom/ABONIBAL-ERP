# Current Mission

## Mission

`V1-AUTH-012 - Account Mapping Runtime Source Decision`

## Classification

`INF`

This is an architecture and implementation-decision documentation mission.

This is not an ECS source-code implementation mission, Route Guard implementation, Product work, or ECS-006.

## Objective

Decide the recommended V1 runtime source for resolving authenticated Firebase users into ABONIBAL ERP account mappings before Route Guard implementation.

The mission records a recommendation for Architect / Owner review. It does not implement the account mapping source.

## Confirmed Problem

V1-AUTH-010 added the `AccountMappingSource` contract.

V1-AUTH-011 added the minimal Login / Logout flow.

Login still cannot create authenticated app state unless provider identity resolves into an explicit project account mapping.

Route Guard must wait until the runtime mapping source is selected, implemented, and verified.

## Recommendation Pending Approval

Recommended V1 mapping source:

`Firebase-backed account mapping source`

The source should map Firebase provider identity to explicit project account data.

Required fields:

- `provider`
- `providerUserId`
- `accountId`
- `accountName`
- `userId`
- `displayName`
- `role`
- optional `email`

Rules:

- `providerUserId` is not `accountId`.
- `accountId` must be explicit.
- `role` must be explicit.
- No default owner fallback.
- Missing mapping must fail safely.
- No hardcoded production mapping.
- No local-only mapping as the official V1 source.

## Options Evaluated

- Firebase custom claims.
- Firebase database account mapping.
- Local development mapping.
- Hardcoded/default mapping.

## Rejected For Official V1 Runtime Source

- Hardcoded/default mapping.
- `providerUserId === accountId`.
- All users become `owner`.
- One global account.
- Local-only mapping as the official runtime source.

Firebase custom claims may be considered later for optimization or authorization strengthening, but should not be the only V1 mapping source unless backend/admin tooling is approved.

## Future Sequence

Recommended future sequence after Architect / Owner approval:

1. `V1-AUTH-013 - Firebase Account Mapping Source Implementation`
2. `V1-AUTH-014 - Authenticated Session Runtime Verification`
3. `V1-AUTH-015 - Route Guard Foundation`
4. `V1-AUTH-016 - Protected Route Runtime Verification`
5. `V1-AUTH-017 - Legacy Storage Compatibility Plan`
6. `V1-AUTH-018 - Account-scoped Persistence Planning`

## Forbidden Scope

- No account mapping source implementation.
- No source-code changes.
- No files under `src/` changed.
- No package or lockfile changes.
- No Firebase Database or Firestore implementation.
- No route guards.
- No Dashboard protection.
- No Products protection.
- No route accessibility changes.
- No Product files changed.
- No persistence behavior changes.
- No localStorage migration.
- No real account mappings.
- No seeded accounts.
- No real credentials.
- No ECS-006.

## Verification Status

- Documentation-only diff required.
- No source files changed.
- No package/build/config files changed.
- No dependencies installed.
- No route guard added.
- No Product files changed.
- No persistence files changed.
- No localStorage migration.
- ROADMAP keeps Route Guard after account mapping source decision, implementation, and runtime verification.
- ECS-006 remains blocked.

## Next Mission

Owner / Architect review of `V1-AUTH-012`.

Recommended next mission after approval:

`V1-AUTH-013 - Firebase Account Mapping Source Implementation`
