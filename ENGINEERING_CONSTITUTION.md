# ABONIBAL ERP Engineering Constitution v1.0

## 1. Purpose

ABONIBAL ERP is a long-term professional ERP product, not a prototype, experiment, or throwaway implementation.

This constitution is the highest engineering authority for implementation work inside this repository. It exists to protect stability, traceability, maintainability, data safety, and the ability to operate the system for years.

## 2. Authority Order

Engineering decisions must follow this order:

1. Project Vision.
2. Project Constitution.
3. Engineering Constitution.
4. Project Orientation.
5. PATCH-000 Outcome.
6. Existing Architecture.
7. Approved Roadmap.
8. Current Mission.
9. Implementation.

When documents conflict, the higher authority wins. If the conflict cannot be resolved from repository evidence, work stops until the owner or architect decides.

## 3. Mission Classifications

All work must be classified before execution.

- ECS: Engineering Change Set for application source changes.
- INF: Engineering infrastructure, repository governance, planning, or release structure.
- ENV: Development environment investigation or repair.
- TOOL: Verification tooling or automation investigation.
- DOC: Documentation-only maintenance.

No mission may silently change classification while in progress. If the real problem belongs to a different classification, stop the current mission, document the boundary, and request the correct mission.

## 4. Evidence Before Code

No ECS may begin with code. Every ECS must pass through:

1. Pre-check.
2. Hypothesis.
3. Baseline Evidence.
4. Root Cause Confirmation.
5. Impact Analysis.
6. Approval.
7. Minimal Implementation.
8. Verification.
9. Evidence Package.
10. Documentation.
11. Commit.
12. Tag.
13. Push.
14. Closure Report.

Code changes are forbidden until runtime or repository evidence proves the problem and identifies the smallest responsible scope.

## 5. Baseline Policy

Every ECS that changes application behavior requires a valid baseline before source modification.

A baseline is valid only if all required evidence files are created, the scenario completes, runtime evidence is collected, console output is saved, screenshot evidence is captured when applicable, and evidence collection itself does not fail.

Failed evidence collection is a Baseline Attempt, not a Baseline. Baseline Attempts must not be used for engineering decisions.

Baseline evidence is read-only after creation. If a baseline is incomplete or invalid, cancel or re-scope the mission and create a new baseline in a new approved attempt.

## 6. Runtime Evidence Policy

Runtime evidence has priority over terminal output, static guesses, and assumptions.

Stable DOM selectors, browser console output, page exceptions, current URL, document title, active route, visible navigation state, screenshots, and scenario-specific measurements must be used when verifying user-visible behavior.

Terminal encoding or tool display artifacts are not application bugs unless browser runtime evidence proves that the application renders the defect.

## 7. Minimal Change Policy

Every change must be limited to the smallest file set that removes the confirmed root cause.

Forbidden without explicit approval:

- New features outside the approved scope.
- Architecture changes.
- Large refactors.
- Moving or renaming stable files.
- Rebuilding stable modules.
- Placeholder implementations.
- TODO-driven delivery.
- Hiding errors instead of resolving root causes.

## 8. Product Engineering vs Infrastructure Policy

Application source changes belong in ECS missions.

Development environment, build tools, runtime tooling, verification tooling, CDP launchers, Playwright infrastructure, shell launch behavior, package-manager behavior, or runtime path problems belong in ENV, TOOL, or INF missions.

Do not modify application code to satisfy a broken verification tool.

If a failure is caused by the environment or tooling:

1. Pause the ECS.
2. Open the appropriate ENV or TOOL mission.
3. Resolve or classify the tooling issue.
4. Return to the ECS only from the verification phase.

Product commits and infrastructure/tooling commits must not be mixed unless explicitly approved by the owner or architect.

## 9. Layer Responsibility

Each layer has one primary responsibility.

- Pages coordinate user interaction and page lifecycle.
- Dialogs collect user input and expose UI state.
- Components render reusable UI fragments.
- Services own business rules.
- Repositories own data access for a specific domain.
- Persistence drivers own storage implementation details.
- Routers and route registries own navigation.
- Infrastructure missions own tooling, governance, and delivery structure.

Business logic must not be moved into Pages, Dialogs, Layouts, or Components unless specifically approved and documented.

## 10. Module Boundaries

Modules must communicate through their approved public APIs. A module must not directly mutate another module's private state.

Circular dependencies are forbidden. If a circular dependency is discovered, it must be treated as a stabilization issue before feature growth continues.

## 11. Data Safety

User and business data are product assets.

No patch may silently delete, overwrite, migrate, or reinterpret persisted data without:

- Root cause evidence.
- Impact analysis.
- Rollback plan.
- Verification before and after.
- Owner or architect approval when compatibility risk exists.

Malformed data must be contained only within the contract of the responsible layer. Safe defaults must match the existing public contract and must not hide unrelated defects.

## 12. Verification Gates

For application ECS work, the standard gates are:

- `pnpm exec tsc --noEmit`
- `pnpm run build`
- Runtime Verification
- Console Errors = 0
- Page Exceptions = 0
- Evidence package complete

INF, ENV, TOOL, and DOC missions use mission-specific verification. TypeScript and build are informational for documentation-only missions and must not substitute for required governance verification.

## 13. Tool Independence

Evidence must prove application behavior, not the health of one tool.

If Playwright, CDP, Chrome launch, pnpm, Node, shell PATH, or another tool fails, classify the failure correctly. Do not call it an application failure unless application runtime evidence proves it.

Verification reports must document the runtime, browser, verification tool, reason for selection, and known limitations when runtime evidence is collected.

## 14. Git Policy

Every ECS, INF, ENV, or TOOL mission that commits work must use a dedicated branch unless the owner explicitly approves otherwise.

Each completed mission must have:

- One coherent commit or an approved small commit series.
- A clear tag when requested.
- Push of branch and tag when remote access is available.
- Final git status clean, except explicitly documented external limitations.

Do not rewrite history, reset, or revert user work without explicit instruction.

## 15. Documentation Policy

Repository documents are part of the product baseline.

The following documents must remain aligned when present:

- `ENGINEERING_CONSTITUTION.md`
- `PROJECT_ORIENTATION.md`
- `PROJECT_STATUS.md`
- `CURRENT_MISSION.md`
- `ROADMAP.md`
- `DECISIONS.md`
- `CHANGELOG.md`
- `RELEASE_NOTES.md`
- Patch or release summaries

Documentation must not invent implementation state. Missing modules must be reported as missing, not described as complete.

## 16. Definition of Done

A mission is complete only when its own completion criteria are satisfied.

For ECS missions, completion requires green TypeScript, green build, runtime verification, clean console, no page exceptions, complete evidence, documentation updates, commit, tag, push, and closure report.

For INF governance missions, completion requires documentation consistency, no application source changes, approved documents tracked, commit, tag, push when available, and closure report.

## 17. V1 Execution Principles

Version 1.0 must prioritize stable daily business operation over breadth.

V1 work must favor:

- Foundation reliability.
- Persistence safety.
- Multi-user foundation.
- Products.
- Inventory.
- Clients and suppliers.
- Sales and invoices.
- Expenses.
- Safes and cash movement.
- Basic auditable ledger.
- Sync data safety and no silent overwrite.
- Basic dashboard and reports.

Advanced permission matrices, multi-branch operation, full advanced accounting, advanced analytics, large refactors, and advanced sync conflict automation are deferred unless the owner or architect changes the roadmap.

## 18. Codex Role

Codex is an engineering executor and investigator. Codex is not the product owner, architect of record, or authority that changes project direction unilaterally.

Codex must preserve scope, gather evidence, implement only approved changes, and stop when owner or architect decisions are required.

## 19. Final Principle

Do not write code merely to close a task. Build a system that can be trusted, verified, maintained, and extended after years of use.
