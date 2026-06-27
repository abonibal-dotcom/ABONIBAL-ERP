# V1-AUTH-003 Architecture Decision

## Mission

`V1-AUTH-003 - Auth Provider Decision Finalization`

Classification:

`INF`

This is an architecture, governance, and decision finalization mission.

No Auth implementation is authorized in this mission.

## 1. Approved Owner Decisions

The Project Owner approved the following V1 Auth decisions:

1. `accountId` is the official V1 data boundary.
2. V1 uses Managed Auth, not Custom Auth.
3. V1 supports only minimal `owner` / `user` roles, without a permission matrix.
4. Existing global localStorage data must be respected and must not be deleted automatically.

Any migration from global storage to account-scoped storage requires a separate ECS with:

- Runtime evidence.
- No-data-loss plan.
- Rollback plan.
- Owner / architect approval.

## 2. Provider Decision

Provider direction:

`Managed Auth approved for V1.`

Concrete provider status:

`Managed Auth direction approved; concrete provider selection remains implementation-planning detail unless owner explicitly chooses one.`

Custom Auth status:

`Rejected for V1.`

No dependency, provider SDK, Firebase/Auth package, or provider code was added in this mission.

## 3. Why Managed Auth Is Preferred Over Custom Auth

Managed Auth is preferred for V1 because:

- It provides a real identity provider without requiring ABONIBAL ERP to design custom security infrastructure.
- It supports session behavior that can later integrate with sync and remote data.
- It reduces the amount of security-critical custom code in the V1 foundation.
- It keeps the project focused on ERP correctness instead of backend authentication design.

Custom Auth is rejected for V1 because:

- It expands scope beyond the current frontend foundation.
- It would require backend architecture decisions that are not established.
- It increases security and maintenance burden too early.
- It risks blocking the business-module roadmap.

## 4. Why `accountId` Is Required For ERP Shared Data

ABONIBAL ERP data is business data, not personal isolated user data.

Multiple users in one business must be able to work inside the same business workspace. Pure per-user storage would isolate data too strongly and could conflict with real ERP operation.

Therefore V1 uses:

```text
accountId: string
```

as the shared data boundary.

Business records should belong to an account/workspace and include user audit metadata such as:

```text
createdBy: string
updatedBy?: string
```

This supports shared operation while preserving traceability.

## 5. Why `owner` / `user` Is Sufficient For V1

V1 needs a minimal role distinction only:

```text
role?: "owner" | "user"
```

This is sufficient for V1 because:

- V1 must prove reliable business operation before advanced administration.
- Basic ownership distinction may be useful for account setup or administrative actions.
- Detailed per-screen permissions are not required to stabilize Products, Inventory, Sales, and core accounting flows.
- Keeping roles minimal reduces implementation and verification risk.

The V1 role model must not imply a full permission matrix.

## 6. Why Permission Matrix Is Deferred

Permission matrix is deferred to V2 because:

- It increases architecture and UI complexity.
- It requires broader owner decisions about job roles, screens, actions, and audit expectations.
- It would slow V1 delivery before the foundation proves stable daily operation.
- V1 can protect business routes through authentication without advanced per-action permissions.

Deferred to V2:

- Advanced roles.
- Permission matrix.
- Per-screen permission rules.
- Advanced admin console.
- Advanced security policies.

## 7. Legacy localStorage Compatibility Decision

Existing global localStorage data must be respected.

Rules:

- Do not delete existing global localStorage data automatically.
- Do not migrate global storage silently.
- Do not overwrite global storage during Auth implementation.
- Do not reinterpret existing data without approved compatibility evidence.

Any migration from global storage to account-scoped storage must be a separate ECS.

Required migration ECS gates:

- Baseline runtime evidence of existing data.
- No-data-loss plan.
- Rollback plan.
- Compatibility plan for global keys such as `products`.
- Runtime verification before and after migration.
- Owner / architect approval.

## 8. Final V1 Auth Direction

V1 Auth foundation is now governed by:

- Managed Auth direction.
- `accountId` account/workspace boundary.
- Minimal `owner` / `user` role model.
- Protected business routes.
- Current user identity and session state.
- Record metadata for future business records.
- No automatic deletion or silent migration of legacy global localStorage data.

## 9. Future ECS Sequence

Record this future sequence only. Do not execute inside V1-AUTH-003.

1. `V1-AUTH-004 - Auth Interfaces And Session Contract`
2. `V1-AUTH-005 - Managed Auth Integration Planning`
3. `V1-AUTH-006 - Login / Logout Minimal Flow`
4. `V1-AUTH-007 - Route Guard Foundation`
5. `V1-AUTH-008 - User / Account Scope Metadata Contract`
6. `V1-AUTH-009 - Persistence User / Account Scope Integration`
7. `V1-AUTH-010 - Legacy Global Storage Compatibility Plan`
8. `V1-AUTH-011 - Runtime User Isolation Verification`

ECS-006 remains blocked until the required Auth foundation has been approved and completed.

## 10. Final Recommendation

Proceed next with:

`V1-AUTH-004 - Auth Interfaces And Session Contract`

Reason:

The provider direction is now approved at the governance level. Before any provider dependency or login UI is introduced, the codebase needs an implementation-ready interface and session contract that preserves the account boundary, role boundary, and legacy data safety decisions.
