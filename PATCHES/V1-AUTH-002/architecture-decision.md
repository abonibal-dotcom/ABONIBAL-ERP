# V1-AUTH-002 Architecture Decision

## Mission

`V1-AUTH-002 - Auth Foundation Architecture Decision & User Scope Contract`

Classification:

`INF`

This is an architecture, governance, and decision mission.

No Auth implementation is authorized in this mission.

## 1. Confirmed Gap

V1-AUTH-001 confirmed the following Auth / multi-user gaps:

- Auth is missing.
- User identity is missing.
- Session model is missing.
- Route guard is missing.
- User-scoped persistence is missing.
- Repository storage is global.
- The app is accessible without login.
- Products are accessible without login.

Evidence from V1-AUTH-001:

- No Auth dependency.
- No Auth module.
- No login/logout behavior.
- No user identity model.
- No session model.
- No route guard.
- No identity-aware navigation.
- No tenant/account boundary.
- `ProductRepository` uses global key `products`.
- Dashboard and Products routes were accessible without Auth at runtime.

## 2. V1 Auth Goal

V1 must support more than one user safely.

Minimum V1 Auth does not need advanced permissions, but it must establish:

- A current user identity.
- A session state.
- Route protection.
- Data ownership metadata.
- User-aware persistence boundary.
- No silent cross-user overwrite.

The goal is not to build an advanced security platform in V1. The goal is to ensure business data can be created, read, and updated without mixing users or accounts silently.

## 3. V1 Auth Scope

V1 Auth / multi-user foundation should include:

- Basic login/logout.
- Current user identity.
- Session persistence / restoration.
- Protected app routes after login.
- Public login route.
- User metadata on created records where needed.
- Storage scoping or user ownership policy.
- Runtime verification for user isolation.
- Safe behavior on logout.
- Safe behavior on refresh.

V1 Auth implementation must be delivered through future approved ECS missions only.

## 4. V2 Deferred Auth Scope

The following are deferred to V2 unless the owner or architect later approves them:

- Advanced roles.
- Permission matrix.
- Per-screen permission rules.
- Advanced admin console.
- Complex audit log UI.
- Multi-tenant enterprise hierarchy.
- SSO.
- MFA.
- Advanced security policies.

These are deferred because V1 must first establish a stable, verifiable identity/session/data-boundary foundation without overcomplicating the release.

## 5. User Identity Contract

Minimum V1 user identity:

```text
UserIdentity
- id: string
- displayName: string
- email?: string
- role?: "owner" | "user"
```

Contract notes:

- `id` is the stable identity key.
- `displayName` is required for visible user context and audit readability.
- `email` is optional because the provider decision is still pending.
- `role` is optional and minimal in V1.
- `role` must not imply a full permission matrix in V1.
- If roles are not needed for the first V1 Auth implementation, V1 may use a single authenticated user class and defer role behavior.

## 6. Session Contract

Minimum V1 session behavior:

- The app knows whether a user is authenticated.
- The app knows the current `UserIdentity` when authenticated.
- The app can restore session on refresh if supported by the chosen implementation.
- The app can clear session on logout.
- The app must not show protected business routes when unauthenticated.
- The app must not silently mix data between users.
- Logout must clear in-memory current-user state.
- Logout must prevent access to protected routes until a user authenticates again.

Session persistence mechanism is pending provider decision and must not be implemented in this mission.

## 7. Route Protection Contract

Public routes:

- Login route.

Protected routes:

- Dashboard.
- Products.
- Future Inventory.
- Future Clients.
- Future Sales.
- Future Accounting.
- Future Reports.

Route behavior:

- Unauthenticated access to a protected route should redirect to login or show an access-required state.
- No business module should be accessible without current user identity in V1.
- Navigation should not expose protected business actions as usable actions when unauthenticated.
- Route protection must be verified at runtime in the future route guard ECS.

## 8. Persistence / User Scope Contract

V1 must prevent cross-user data mixing.

### Option A - Storage-key Scoping

Example:

```text
products:{userId}
```

Pros:

- Simple.
- Clear isolation.
- Works local-first.

Cons:

- Shared business data between users becomes harder.
- Later migration may be needed.
- It can model personal data, but ERP data is usually shared inside a business.

### Option B - Record Ownership Metadata

Example:

```text
createdBy
updatedBy
ownerId
```

Pros:

- Better for shared datasets.
- Easier future sync/account-level model.
- Preserves record-level auditability.

Cons:

- Requires filtering and repository awareness.
- More implementation complexity.
- Ownership alone does not define the shared business boundary.

### Option C - Account / Workspace Scope

Example:

```text
accountId
workspaceId
createdBy
updatedBy
```

Pros:

- Best fit for real multi-user ERP data.
- Multiple users can share one business workspace.
- Better long-term architecture for sync, reporting, audit, and permissions.

Cons:

- Requires early contract discipline.
- Slightly larger V1 design.
- Requires clear compatibility decisions for existing global storage keys.

### Architect Recommendation

For ABONIBAL ERP V1, prefer an account/workspace boundary:

```text
accountId: string
createdBy: string
updatedBy?: string
```

Rationale:

The owner requires more than one user. ERP data is usually shared by users inside the same business, not isolated per personal user. V1 should avoid pure per-user storage if that would prevent shared business operation or force an avoidable migration later.

## 9. Recommended V1 Data Ownership Contract

Recommended minimum for future business records:

```text
BaseRecord
- id: string
- accountId: string
- createdAt: string
- updatedAt: string
- createdBy: string
- updatedBy?: string
```

Contract notes:

- `accountId` defines the shared business/workspace boundary.
- `createdBy` and `updatedBy` reference user identity IDs.
- `createdAt` and `updatedAt` should be stable serialized strings for persistence and sync compatibility.
- This is a contract decision only.
- Do not implement it in this mission.

## 10. Auth Provider Decision Options

### Option A - Local-only Auth

Pros:

- Simple.
- No external dependency.
- Can support early local runtime verification.

Cons:

- Weak multi-user support.
- Not production-grade for shared users.
- Poor future sync/security model.
- Does not naturally solve cross-device identity.

### Option B - Firebase Auth Or Equivalent Managed Auth

Pros:

- Real identity provider.
- Session handling.
- Future sync integration.
- Better production direction.
- Reduces custom security surface.

Cons:

- Adds dependency and setup complexity.
- Requires environment/config decisions.
- Requires owner approval for provider and deployment assumptions.

### Option C - Custom Backend Auth

Pros:

- Full control.
- Can be tailored to ERP-specific rules.

Cons:

- Too large for current V1 foundation.
- Requires backend architecture not yet established.
- Expands scope before the frontend foundation is ready.

### Architect Recommendation

Use managed Auth for V1 if the project intends remote sync or real multi-user operation.

Provider decision status:

`PENDING OWNER / ARCHITECT APPROVAL`

No provider dependency may be added until the provider decision is approved in a future mission.

## 11. Recommended Implementation Sequence

Future ECS / INF order only. Do not execute inside V1-AUTH-002.

1. `V1-AUTH-003 - Auth Provider Decision Finalization`
   - Classification: INF.
   - Objective: approve local-only, managed Auth, or backend Auth provider direction.

2. `V1-AUTH-004 - Auth Interfaces And Session Contract`
   - Classification: ECS.
   - Objective: add minimal interfaces/contracts for user identity and session state after provider decision.

3. `V1-AUTH-005 - Login / Logout Minimal Flow`
   - Classification: ECS.
   - Objective: implement public login route, logout behavior, and current-user state.

4. `V1-AUTH-006 - Route Guard Foundation`
   - Classification: ECS.
   - Objective: protect Dashboard, Products, and future business routes.

5. `V1-AUTH-007 - User / Account Scope Metadata Contract`
   - Classification: ECS.
   - Objective: introduce approved BaseRecord/account ownership contracts.

6. `V1-AUTH-008 - Persistence User / Account Scope Integration`
   - Classification: ECS.
   - Objective: integrate account-aware persistence boundaries and compatibility behavior.

7. `V1-AUTH-009 - Runtime User Isolation Verification`
   - Classification: ECS.
   - Objective: prove user/account isolation through runtime evidence.

If provider decision is approved inside a later owner review of V1-AUTH-002, `V1-AUTH-003` may be skipped or converted into implementation planning.

## 12. Risks

- Building Products before Auth could create data migration risk.
- Per-user storage may conflict with shared ERP operation.
- No account boundary may cause cross-user overwrite.
- Adding advanced roles too early may overcomplicate V1.
- Choosing custom auth too early may expand scope.
- Sync and Auth must not be designed independently.
- Existing global storage keys need an explicit compatibility strategy before account-scoped persistence changes.
- A weak local-only Auth choice may become expensive if remote sync is later required.

## 13. Final Recommendation

V1 should use:

- Basic authenticated user identity.
- Session state.
- Protected business routes.
- Account/workspace boundary.
- Record metadata: `accountId`, `createdBy`, `updatedBy`.
- Basic role only if needed.
- Advanced permission matrix deferred to V2.

Provider decision remains pending owner/architect approval.

No Auth implementation may begin until the owner/architect approves this contract and the provider decision path.
