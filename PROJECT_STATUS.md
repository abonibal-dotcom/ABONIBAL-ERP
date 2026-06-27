# ABONIBAL ERP Project Status

## Current Status

PATCH-000 is complete.

V1 roadmap execution is in progress through approved verification missions.

No ECS-006 has started.

V1-INF-001 has been executed and integrated into the active baseline branch.

V1-INF-002 governance baseline review and integration is complete.

V1-FND-001 Foundation Verification Baseline is complete from execution side and ready for Architect / Owner review.

V1-PER-001 Persistence Safety Baseline is complete from execution side and ready for Architect / Owner review.

V1-PER-002 Storage Wrapper Read Resilience is complete from execution side and ready for Architect / Owner review.

V1-AUTH-001 Auth / Multi-user Foundation Baseline is complete from execution side and ready for Architect / Owner review.

V1-AUTH-002 Auth Foundation Architecture Decision & User Scope Contract is complete from execution side and ready for Architect / Owner review.

V1-AUTH-003 Auth Provider Decision Finalization is complete from execution side and ready for Architect / Owner review.

V1-AUTH-004 Auth Interfaces And Session Contract is complete from execution side and ready for Architect / Owner review.

V1-AUTH-005 Managed Auth Integration Planning is complete from execution side and ready for Architect / Owner review.

V1-AUTH-006 Managed Auth Dependency & Config Skeleton is complete from execution side and ready for Architect / Owner review.

V1-AUTH-007 Managed Auth Provider Adapter is complete from execution side and ready for Architect / Owner review.

Completed stabilization work:

- `PATCH-000-ECS-001 - Route Registry Stabilization`
- `PATCH-000-ECS-002 - Product Page Listener Lifecycle Stabilization`
- `PATCH-000-ECS-003A - Dashboard Copy Stabilization`
- `PATCH-000-ECS-004 - Dashboard Text Encoding Investigation`
- `PATCH-000-ECS-005 - LocalStorage Read Resilience`

## Engineering State

- Engineering workflow is stable.
- Git workflow is stable.
- Runtime verification workflow is stable.
- Baseline and evidence policy is established.
- Product engineering and infrastructure/tooling work are separated by mission type.

## Application State

- Foundation exists.
- Routing and Sidebar route surface exist.
- Dashboard exists as a basic page.
- Persistence exists with localStorage driver and repository abstraction.
- Persistence safety baseline confirmed `LocalStorageDriver.read<T>()` contains malformed JSON safely.
- Persistence safety baseline confirmed `Storage.get<T>()` had a malformed JSON read-path safety issue.
- V1-PER-002 contained malformed JSON failures inside `Storage.get<T>()` while preserving valid and missing-key behavior.
- Auth / multi-user foundation baseline confirmed no Auth dependency, user identity model, session model, route guard, or user-scoped persistence currently exists.
- V1-AUTH-002 defined the proposed Auth/user scope contract: user identity, session state, protected business routes, account/workspace boundary, and ownership metadata.
- Owner approved `accountId` as the V1 data boundary.
- Owner approved Managed Auth as the V1 provider direction.
- Owner approved minimal `owner` / `user` roles for V1.
- Owner approved no automatic deletion or migration of existing global localStorage data.
- V1-AUTH-003 finalized provider decision documentation.
- V1-AUTH-004 introduced minimal provider-neutral Auth/session TypeScript contracts under `src/modules/auth/`.
- V1-AUTH-004 did not add dependencies, provider code, login/logout behavior, route guards, routing changes, persistence changes, localStorage migration, Product changes, or UI changes.
- V1-AUTH-005 recommended Firebase Auth as the first Managed Auth provider for V1, with the concrete provider decision still pending owner approval.
- V1-AUTH-005 documented dependency/config, provider adapter, Auth state, login/logout, route guard, `accountId`, legacy storage compatibility, and account-scoped persistence planning sequence.
- V1-AUTH-005 did not change source code, dependencies, package/build/config files, runtime behavior, routing, persistence, Products, or ECS-006.
- Owner approved Firebase Auth as the concrete V1 Managed Auth provider for V1-AUTH-006.
- V1-AUTH-006 added the Firebase dependency, safe environment placeholders, and call-only Firebase config/client skeleton.
- V1-AUTH-006 did not wire Firebase into app startup, login/logout, route guards, persistence, Products, or ECS-006.
- V1-AUTH-007 added a Firebase-backed `AuthProvider` adapter behind the existing Auth contract.
- V1-AUTH-007 keeps full `AuthSession` creation behind an explicit session resolver and does not assume `firebaseUser.uid === accountId`.
- V1-AUTH-007 did not add login UI, route guards, route accessibility changes, app startup wiring, persistence changes, localStorage migration, Product work, or ECS-006.
- Products module is partial.
- Product dialog lifecycle was stabilized.
- Malformed product localStorage read failures were contained.
- Inventory is missing as a module.
- Clients are missing.
- Suppliers are missing.
- Sales and invoices are missing.
- Expenses are missing.
- Safes and cash movement are missing.
- Basic ledger is missing.
- Sync/data-safety module is missing.
- Reports are missing.
- Auth implementation is still missing, but the V1 account boundary, Firebase provider decision, role boundary, and legacy storage safety decisions are now documented.

## Current Mission

Current mission:

`V1-AUTH-007 - Managed Auth Provider Adapter`

Current next mission:

V1-AUTH-007 execution closure and Architect / Owner review.

Classification:

`ECS`

Allowed scope:

Firebase Auth adapter behind the existing `AuthProvider` contract only.

Forbidden scope:

No login UI, no route guards, no route accessibility changes, no app startup behavior changes, no persistence behavior changes, no localStorage migration, no Product work, no ECS-006, no permission matrix, no account migration, no hardcoded credentials, and no real Firebase credentials.

## Next State

After V1-AUTH-007 is reviewed and approved, the recommended next candidate is `V1-AUTH-008 - Auth State Service` before login UI, route guards, persistence changes, and product-module expansion.
