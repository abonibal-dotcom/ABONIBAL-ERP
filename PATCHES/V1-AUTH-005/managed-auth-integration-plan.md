# V1-AUTH-005 Managed Auth Integration Plan

## Mission

`V1-AUTH-005 - Managed Auth Integration Planning`

Classification:

`INF`

This is a planning mission only. No Auth implementation, dependency installation, source-code change, login UI, route guard, persistence change, localStorage migration, Product work, or ECS-006 work is authorized here.

## Inputs Reviewed

Project documents:

- `ENGINEERING_CONSTITUTION.md`
- `PROJECT_ORIENTATION.md`
- `PROJECT_STATUS.md`
- `CURRENT_MISSION.md`
- `ROADMAP.md`
- `DECISIONS.md`
- `PATCHES/V1-AUTH-002/architecture-decision.md`
- `PATCHES/V1-AUTH-003/architecture-decision.md`
- `PATCHES/V1-AUTH-004/closure-report.md`
- `PATCHES/V1-AUTH-004/verification.md`
- `CHANGELOG.md`

Source files inspected read-only:

- `package.json`
- `tsconfig.json`
- `src/main.ts`
- `src/core/Application.ts`
- `src/core/Container.ts`
- `src/core/Config.ts`
- `src/core/Router.ts`
- `src/router/routes.ts`
- `src/router/PageManager.ts`
- `src/modules/auth/AuthRole.ts`
- `src/modules/auth/UserIdentity.ts`
- `src/modules/auth/AccountIdentity.ts`
- `src/modules/auth/AuthSession.ts`
- `src/modules/auth/AuthState.ts`
- `src/modules/auth/AuthProvider.ts`
- `src/modules/auth/OwnershipMetadata.ts`

External provider references consulted:

- Firebase Web SDK setup: `https://firebase.google.com/docs/web/setup`
- Supabase JavaScript client install: `https://supabase.com/docs/reference/javascript/installing`
- Auth0 SPA SDK: `https://auth0.com/docs/libraries/auth0-single-page-app-sdk`
- Clerk JavaScript SDK quickstart: `https://clerk.com/docs/js-frontend/getting-started/quickstart`

## 1. Provider Recommendation

### Provider Decision Status

Recommended:

`Firebase Auth`

Approved:

`No`

Pending owner decision:

`Yes`

This mission recommends Firebase Auth as the first Managed Auth provider for V1, but does not finalize the provider as an owner-approved decision. `DECISIONS.md` must not be changed until the owner or architect explicitly approves a concrete provider.

### Options Evaluated

| Option | Fit For Current Stack | Strengths | Risks / Tradeoffs | V1 Recommendation |
| --- | --- | --- | --- | --- |
| Firebase Auth | Strong fit for Vite browser app | Managed identity, session persistence, modular browser SDK, widely supported, future Firebase-backed sync/data path remains possible | Adds Firebase dependency and environment configuration; account/workspace mapping still needs app-level design | Primary recommendation |
| Supabase Auth | Good fit if Supabase database becomes the data backend | Auth and Postgres-backed data can be aligned later; official JS client exists | Implies a stronger backend/data direction earlier; may pull persistence architecture forward before V1 is ready | Keep as alternative if owner wants Supabase data stack |
| Auth0 | Good managed identity platform | Strong SPA auth support and enterprise identity options | More identity-platform oriented than ERP data/sync oriented; account/workspace data still entirely app-defined | Defer unless owner prefers Auth0 |
| Clerk | Good browser/Vite support and strong prebuilt auth UX | Fast UI-driven authentication setup; organization features may help later | Prebuilt UI could pressure project UI scope; account/workspace mapping still requires discipline | Defer unless owner wants Clerk UX/organization model |

### Why Firebase Auth First

Firebase Auth is the safest first recommendation because:

- It aligns with the already approved Managed Auth direction.
- It is suitable for a Vite browser application.
- It can map behind the existing provider-neutral `AuthProvider` contract.
- It supports session restoration without forcing custom Auth infrastructure.
- It keeps a future path open for Firebase-backed data or sync work if the owner later approves it.
- It avoids adopting a heavier enterprise identity surface before V1 proves stable daily operation.

## 2. Dependency Impact

Future package likely needed:

```text
firebase
```

Future ECS impact:

- `package.json` will change only in `V1-AUTH-006 - Managed Auth Dependency & Config Skeleton`.
- `pnpm-lock.yaml` will change only when the dependency is installed.
- The provider adapter should import only required Firebase modules, such as app initialization and Auth APIs, to preserve tree-shaking.
- Build output size is expected to increase because a provider SDK is a runtime dependency.
- The exact build impact must be measured in the dependency/config ECS.

Current mission impact:

- No package installed.
- `package.json` unchanged.
- `pnpm-lock.yaml` unchanged.
- No runtime bundle change.

## 3. Environment / Config Plan

Future Firebase configuration should use Vite public environment variables, not hardcoded values.

Recommended naming:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_STORAGE_BUCKET
```

Rules:

- No secrets in source code.
- No private service-account credentials in the browser app.
- Browser Firebase config is public configuration, but must still be controlled through environment files and deployment settings.
- Add `.env.example` only in the future config ECS if approved.
- Missing required config should fail in a controlled startup/config validation path, not deep inside Pages or business modules.
- Do not introduce placeholder runtime behavior that pretends Auth is configured.

Future config location recommendation:

- Extend the existing config boundary around `src/core/Config.ts` or a nearby config module in a future ECS.
- Keep provider-specific config outside Pages and business modules.
- Register provider/config services through `Container.boot()` only when the dependency/config skeleton ECS authorizes it.

## 4. AuthProvider Mapping

The provider SDK must remain behind the existing `AuthProvider` interface:

```text
getCurrentSession(): Promise<AuthSession | null>
signIn(credentials: SignInCredentials): Promise<AuthSession>
signOut(): Promise<void>
```

### getCurrentSession()

Future Firebase adapter behavior:

- Ask Firebase Auth for the currently authenticated provider user.
- If no provider user exists, return `null`.
- If a provider user exists, map it to `AuthSession`.
- Resolve `accountId` through the account mapping layer, not by assuming `uid === accountId`.
- Map display name and email from provider profile when available.
- Map role through claims/profile/account membership, not UI hardcoding.

### signIn(credentials)

Future Firebase adapter behavior:

- Use email/password credentials only if the owner approves email/password as the first login method.
- Return a full `AuthSession` after provider sign-in succeeds and account mapping resolves.
- Throw provider/auth errors to an Auth service boundary for normalized handling; Pages should not depend on Firebase error objects.

### signOut()

Future Firebase adapter behavior:

- Call provider sign-out.
- Clear in-memory `AuthState`.
- Leave legacy global localStorage data untouched.
- Route guard/login flow ECS should decide post-sign-out navigation.

### Boundary Rule

No direct provider SDK usage should leak into:

- Pages.
- Product modules.
- Persistence repositories.
- Router route definitions.
- Business services.

The only provider-specific code should live in a future Auth provider adapter module.

## 5. Session Restoration Plan

Future session flow:

1. App startup begins.
2. Auth provider adapter checks current provider session.
3. If authenticated, the app creates an `AuthSession`.
4. If unauthenticated, the app transitions to `{ status: "unauthenticated" }`.
5. Future route guard reads `AuthState`.
6. Protected routes are blocked or redirected only after the route guard ECS.
7. Business modules never read the provider SDK directly.

Current mission behavior:

- No startup behavior changes.
- No route behavior changes.
- No `AuthState` runtime implementation.

## 6. accountId Resolution Plan

### Option A - `accountId` equals provider user uid

Pros:

- Simple.
- Easy to implement quickly.

Cons:

- Weak for shared business accounts.
- Treats ERP workspace as personal identity.
- Conflicts with the approved account/workspace boundary for shared ERP data.

Decision:

Not recommended as the V1 default.

### Option B - `accountId` stored in provider profile/claims

Pros:

- Clear mapping from identity provider to account/workspace.
- Can support multi-user account membership later.
- Keeps `accountId` outside business modules.

Cons:

- May require backend/admin setup or provider custom claims.
- Needs a controlled onboarding/admin process.

Decision:

Recommended long-term direction.

### Option C - local account/workspace record linked to authenticated user

Pros:

- Useful for early V1 if backend account administration is not ready.
- Keeps account/workspace as a first-class concept.
- Can support a controlled initial owner setup.

Cons:

- Must not be treated as final multi-tenant security.
- Needs no-data-loss planning before persistence integration.
- Requires careful runtime verification for user/account isolation.

Decision:

Acceptable as an initial V1 bridge only if documented and verified.

### Recommendation

Use an explicit account mapping layer.

Do not assume:

```text
userId === accountId
```

Initial V1 may use a controlled default account for the first owner setup, but that must be documented as a transitional implementation detail, not a final multi-tenant model.

## 7. owner/user Role Plan

V1 roles remain:

```text
owner
user
```

Rules:

- `owner` is the account owner/admin role for V1.
- `user` is a regular account user role for V1.
- No permission matrix in V1.
- No per-screen advanced permissions in V1.
- No advanced roles in V1.
- Role belongs in `UserIdentity.role` inside `AuthSession`.
- Role source should later be provider claims, provider profile metadata, or account membership data.
- Pages must not hardcode role logic directly.

V2 may add a permission matrix after V1 core business correctness is stable.

## 8. Route Guard Future Plan

Future route guard ECS must introduce:

- Public login route.
- Protected Dashboard route.
- Protected Products route.
- Protected future business routes.
- Unauthenticated redirect to login or an access-required state.
- Refresh-safe session restoration before protected route access.

Guard boundaries:

- Router or route manager owns navigation access behavior.
- Auth service/session state owns authentication state.
- Pages should not self-guard with provider SDK calls.

Current mission:

- No route guard is implemented.
- Dashboard and Products accessibility remains unchanged.

## 9. Persistence Scope Future Plan

Persistence integration must remain separate from provider integration.

Rules:

- Existing global localStorage must be respected.
- No automatic deletion.
- No silent migration.
- No reinterpretation of existing global data without evidence.
- Account-scoped persistence must be introduced only through a future approved ECS.
- Migration requires runtime baseline, no-data-loss plan, rollback plan, owner/architect approval, and after-verification.

Future sequence should separate:

- Auth dependency/config.
- Auth provider adapter.
- Auth state.
- Login/logout UI flow.
- Route guard.
- accountId resolution.
- Legacy storage compatibility plan.
- Account-scoped persistence planning/integration.

## 10. Risk Register

| Risk | Level | Mitigation |
| --- | --- | --- |
| Provider lock-in | Medium | Keep provider-specific code behind `AuthProvider`; document provider decision before dependency install |
| Config/secrets mishandling | High | Use Vite env variables; no hardcoded secrets; no service-account credentials in browser |
| `accountId` / `userId` confusion | High | Use explicit account mapping layer; forbid `userId === accountId` assumption |
| Legacy global storage migration risk | High | Separate migration ECS with baseline, no-data-loss plan, rollback plan, owner approval |
| Route guard blocks app incorrectly | High | Implement route guard after session restoration; runtime verify refresh and unauthenticated paths |
| Login before contract verification | Medium | Keep adapter, auth state, login UI, and route guard as separate ECS missions |
| Provider leaking into business modules | High | Enforce adapter boundary and container/service ownership |
| Multi-user overwrite if persistence scope is delayed | High | Do not resume Product expansion until Auth/session/account boundary and storage compatibility plan are approved |
| Advanced permissions creep | Medium | Keep V1 roles to `owner` / `user`; defer matrix to V2 |

## 11. Future ECS Sequence

Recommended future sequence after owner/architect approval:

1. `V1-AUTH-006 - Managed Auth Dependency & Config Skeleton`
   - Classification: ECS.
   - Scope: install provider package, add safe config boundary, no login UI.
   - Verification: TypeScript, build, runtime non-regression, no route behavior change.

2. `V1-AUTH-007 - Managed Auth Provider Adapter`
   - Classification: ECS.
   - Scope: implement provider-specific adapter behind `AuthProvider`.
   - Verification: adapter-level behavior, no direct SDK imports outside adapter.

3. `V1-AUTH-008 - Auth State Service`
   - Classification: ECS.
   - Scope: session state and restoration boundary.
   - Verification: loading/authenticated/unauthenticated state transitions.

4. `V1-AUTH-009 - Login / Logout Minimal Flow`
   - Classification: ECS.
   - Scope: public login route and logout command only.
   - Verification: login/logout runtime flow, clean console, no page exceptions.

5. `V1-AUTH-010 - Route Guard Foundation`
   - Classification: ECS.
   - Scope: protect Dashboard, Products, and future business routes.
   - Verification: unauthenticated access blocked; authenticated access allowed; refresh-safe behavior.

6. `V1-AUTH-011 - accountId Resolution Baseline`
   - Classification: ECS.
   - Scope: explicit account mapping baseline and owner/user role mapping.
   - Verification: `AuthSession.user.accountId` and `AuthSession.account.id` consistent.

7. `V1-AUTH-012 - Runtime Auth Session Verification`
   - Classification: ECS.
   - Scope: runtime evidence for session restoration, refresh, logout, route access, and account identity.
   - Verification: browser evidence package with console errors = 0 and page exceptions = 0.

8. `V1-AUTH-013 - Legacy Storage Compatibility Plan`
   - Classification: INF / ECS planning.
   - Scope: no-data-loss plan for global keys such as `products`.
   - Verification: baseline evidence and rollback plan.

9. `V1-AUTH-014 - Account-scoped Persistence Planning`
   - Classification: INF / ECS planning.
   - Scope: plan account-aware persistence integration after compatibility plan.
   - Verification: owner/architect approval before source changes.

## 12. Remaining Owner Decisions

The owner or architect must still decide:

- Whether Firebase Auth is approved as the concrete V1 Managed Auth provider.
- Which first login method is required, such as email/password only or another provider-supported method.
- Whether initial V1 account setup may use a controlled default account for first owner onboarding.
- Whether account membership and roles will initially live in provider claims/profile metadata or local account records.
- Whether Firebase-backed data/sync is intended later, or Auth only.

## 13. Decision

Managed Auth integration planning is ready for owner/architect review.

No Auth implementation was performed in this mission.
