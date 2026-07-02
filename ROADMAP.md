# ABONIBAL ERP Version 1.0 Roadmap

## Roadmap Status

This is the official Version 1.0 roadmap baseline for repository governance.

ECS-006 Product List Read Path is complete from execution side and ready for Architect / Owner review.

Product-code work resumed only after the approved Auth / Route Guard foundation reached the accepted V1-AUTH-015 baseline.

## V1 Definition

Version 1.0 is a stable daily-operation ERP foundation, not a full enterprise suite.

V1 must prioritize reliable business operation, data safety, basic auditability, and predictable runtime behavior over breadth of features.

## Owner Decisions Locked For V1

- V1 must support more than one user.
- Product images are optional in V1.
- V1 must prevent selling unavailable stock.
- V1 supports basic discounts.
- Tax rules are deferred unless legally or business required.
- V1 includes a basic auditable ledger.
- Full double-entry accounting is deferred unless later approved.
- V1 sync scope is data safety and no silent overwrite.
- Advanced conflict resolution is V2.
- V1 reports are basic only.
- V1 uses `accountId` as the account/workspace data boundary.
- V1 uses Managed Auth direction.
- V1 uses Firebase Auth as the concrete Managed Auth provider.
- V1 role model is limited to `owner` and `user`.
- Existing global localStorage data must not be deleted automatically.

## V1 Scope

V1 includes:

- Foundation reliability.
- Persistence safety.
- Auth / multi-user foundation.
- Products.
- Inventory.
- Clients.
- Suppliers.
- Sales / invoices.
- Expenses.
- Safes / cash movement.
- Basic auditable ledger.
- Data safety / no silent overwrite.
- Basic dashboard.
- Basic reports.

## V2 Deferred Scope

The following are deferred to V2 unless the owner or architect changes the roadmap:

- Advanced roles.
- Permission matrix.
- Advanced admin console.
- Multi-branch support.
- Full advanced accounting.
- Advanced analytics.
- Advanced reports.
- Advanced import/export.
- Full UI redesign.
- Large refactors.
- Advanced sync conflict automation.
- Advanced product image flow.

These items do not block V1 because V1 must first prove stable daily operation, data safety, and core business correctness.

## Implementation Order

1. Repository Governance & Baseline Lock.
2. Foundation Verification.
3. Persistence Safety.
4. Auth / Multi-user Foundation.
5. Products.
6. Inventory.
7. Clients / Suppliers.
8. Sales / Invoices.
9. Expenses.
10. Safes / Cash.
11. Basic Ledger.
12. Sync / Data Safety.
13. Dashboard / Basic Reports.
14. V1 Release Candidate.

## Dependency Graph

Foundation Verification

-> Persistence Safety

-> Auth / Multi-user Foundation

-> Products

-> Inventory

-> Clients / Suppliers

-> Sales / Invoices

-> Expenses

-> Safes / Cash

-> Basic Ledger

-> Sync / Data Safety

-> Dashboard / Basic Reports

-> V1 Release Candidate

## First Execution Candidate After Governance Integration

The first mission after V1-INF-002 should not automatically be Products.

The next candidate should be selected from Foundation Verification, Persistence Safety, or Auth / Multi-user Foundation based on evidence and owner approval.

ECS-006 was explicitly approved by the owner and executed after the accepted V1-AUTH-015 Route Guard foundation baseline.

## Auth / Multi-user Foundation Gate

Before Products or other business modules continue, V1 must approve and implement the minimum Auth foundation:

- User identity.
- Session state.
- Protected business routes.
- Account/workspace data boundary.
- Record ownership metadata.
- Runtime user/account isolation verification.

Auth provider direction is Managed Auth.

`accountId` boundary is required before business modules become user-safe.

Advanced roles and permission matrix are V2.

localStorage migration is not automatic and must be a separate ECS with runtime evidence, no-data-loss plan, rollback plan, and owner / architect approval.

Product-code work may proceed only through owner-approved missions after the accepted Auth / Route Guard foundation baseline.

## Planned Auth Foundation Sequence

The concrete Managed Auth provider is approved.

Approved provider:

`Firebase Auth`

Recommended next Auth sequence:

1. `V1-AUTH-006 - Managed Auth Dependency & Config Skeleton`.
2. `V1-AUTH-007 - Managed Auth Provider Adapter`.
3. `V1-AUTH-008 - Auth State Service`.
4. `V1-AUTH-009 - AccountId / Auth Session Resolution Baseline`.
5. `V1-AUTH-010 - Account Mapping Source Baseline`.
6. `V1-AUTH-011 - Login / Logout Minimal Flow`.
7. `V1-AUTH-012 - Account Mapping Runtime Source Decision`.
8. `V1-AUTH-013 - Firebase Account Mapping Source Implementation`.
9. `V1-AUTH-014 - Authenticated Session Runtime Verification`.
10. `V1-AUTH-015 - Route Guard Foundation`.
11. `V1-AUTH-016 - Protected Route Runtime Verification`.
12. `V1-AUTH-017 - Legacy Storage Compatibility Plan`.
13. `V1-AUTH-018 - Account-scoped Persistence Planning`.

Sequencing decision:

`V1-AUTH-009` is no longer Login / Logout Minimal Flow.

Login / Logout must occur after account/session resolution because `FirebaseAuthProvider` must not assume `firebaseUser.uid === accountId`, and the project must preserve `accountId` as the official V1 data boundary before user-facing authentication flow work begins.

`V1-AUTH-010` is Account Mapping Source Baseline, not Login / Logout Minimal Flow.

Login / Logout must also occur after a safe source exists for resolving provider identity into account identity, `accountId`, and V1 role.

`V1-AUTH-012` is Account Mapping Runtime Source Decision, not Route Guard Foundation.

Route Guard must occur only after account mapping source decision, Firebase account mapping source implementation, and authenticated session runtime verification.

Owner-approved V1 runtime mapping source is Firebase-backed account mapping.

The official V1 mapping source must return explicit provider, providerUserId, accountId, accountName, userId, displayName, and role data. It must not use providerUserId as accountId, default owner fallback, one global account, hardcoded production mappings, or local-only mappings as the official runtime source.

`V1-AUTH-013` implements the Firebase-backed account mapping source. Live authenticated-session runtime verification remains `V1-AUTH-014`.

Product-code work resumed through ECS-006 after owner approval and the accepted V1-AUTH-015 Route Guard foundation baseline.

## Product Persistence Boundary Gate

V1-PER-003 assessed Product persistence after ECS-006.

Current Product persistence uses the global localStorage key `products`.

Current Product records do not contain `accountId`, `createdBy`, or `updatedBy`.

Product reads and existing write methods do not currently receive account context.

Recommended next Product persistence step:

`V1-PER-004 - Product Account-scoped Persistence Plan`

Product Create/Edit/Delete should wait for an approved Product account-scoped persistence plan and no-data-loss compatibility strategy.

## Verification Expectation

Each future ECS must include:

- Pre-check.
- Baseline evidence.
- Root cause confirmation.
- Minimal scope.
- TypeScript verification.
- Build verification.
- Runtime verification.
- Evidence package.
- Documentation updates.
- Commit.
- Tag.
- Push.
- Closure report.
