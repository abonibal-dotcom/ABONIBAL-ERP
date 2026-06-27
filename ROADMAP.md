# ABONIBAL ERP Version 1.0 Roadmap

## Roadmap Status

This is the official Version 1.0 roadmap baseline for repository governance.

ECS-006 is not started.

No product-code work may begin until the Auth / Multi-user Foundation contract is approved and the required Auth foundation steps are complete.

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

ECS-006 remains blocked until explicitly approved by the owner or architect.

## Auth / Multi-user Foundation Gate

Before Products or other business modules continue, V1 must approve and implement the minimum Auth foundation:

- User identity.
- Session state.
- Protected business routes.
- Account/workspace data boundary.
- Record ownership metadata.
- Runtime user/account isolation verification.

Auth provider decision is pending owner / architect approval.

Product-code work remains blocked until this gate is satisfied.

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
