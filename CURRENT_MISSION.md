# Current Mission

## Mission

`V1-AUTH-013 - Firebase Account Mapping Source Implementation`

## Classification

`ECS`

This is a limited Auth implementation mission.

This is not Route Guard implementation, Product work, persistence migration, account-scoped Product persistence, or ECS-006.

## Objective

Implement the approved Firebase-backed account mapping source that resolves Firebase provider users into explicit ABONIBAL ERP account mappings.

The mission preserves `accountId` as the official V1 data boundary and must not assume Firebase uid is an `accountId`.

## Approved Source

Approved V1 runtime source:

`Firebase-backed account mapping source`

Implemented path:

```text
accountMappings/firebase/providerUsers/{providerUserId}
```

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
- Role must be `owner` or `user`.
- No default owner fallback.
- Missing mapping must fail safely.
- Invalid mapping must not create an authenticated app session.
- No hardcoded production mapping.
- No real credentials.

## Implementation Status

Implemented:

- `FirebaseAccountMappingSource`
- Auth runtime wiring to Firebase account mapping source when Firebase config is present.
- Firebase sign-out on session-resolution exception after Firebase sign-in.

Not implemented:

- Route Guard.
- Dashboard protection.
- Products protection.
- Account-scoped persistence.
- localStorage migration.
- Live authenticated-session verification with real test credentials.

## Verification Status

- TypeScript: PASS.
- Build: PASS.
- Runtime: PASS.
- Console errors: 0.
- Page exceptions: 0.
- Active network failures: 0.
- External Firebase startup requests: 0.

Runtime evidence:

```text
C:\Users\aboni\Documents\Codex\2026-06-26\abonibal-dotcom-abonibal-erp-https-github-3\outputs\V1-AUTH-013\after-runtime.json
C:\Users\aboni\Documents\Codex\2026-06-26\abonibal-dotcom-abonibal-erp-https-github-3\outputs\V1-AUTH-013\after-dom.json
C:\Users\aboni\Documents\Codex\2026-06-26\abonibal-dotcom-abonibal-erp-https-github-3\outputs\V1-AUTH-013\after-console.log
C:\Users\aboni\Documents\Codex\2026-06-26\abonibal-dotcom-abonibal-erp-https-github-3\outputs\V1-AUTH-013\after-screenshot.png
```

## Forbidden Scope Confirmation

- No route guard.
- No Dashboard protection.
- No Products protection.
- No Product files changed.
- No persistence files changed.
- No localStorage migration.
- No account-scoped persistence.
- No real credentials.
- No production mappings.
- No seeded accounts.
- No ECS-006.

## Next Mission

Owner / Architect review of `V1-AUTH-013`.

Recommended next mission after approval:

`V1-AUTH-014 - Authenticated Session Runtime Verification`
