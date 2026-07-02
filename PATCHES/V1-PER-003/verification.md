# V1-PER-003 Verification

## Mission

`V1-PER-003 - Product Persistence Boundary Assessment`

## Classification

`INF`

## Verification Environment

- Runtime: Vite dev server.
- Browser: Chrome headless through CDP.
- Verification Tool: Node.js CDP script using the built-in WebSocket runtime.
- Reason for Selection: deterministic DOM, storage, console, page exception, and screenshot evidence without adding project dependencies or modifying source code.
- Known Limitations: runtime storage inspection used an isolated copy of the accepted ECS-006 Chrome profile on the same localhost origin so the existing ECS-006 Product record could be inspected without mutating Product data.

## Preflight

- `.env` exists: yes.
- Required Firebase `VITE_FIREBASE_*` keys present: yes.
- Approved local test email present: yes.
- Approved local test password present: yes.
- `.env` tracked by Git: no.
- Accepted baseline tag `ecs-006-product-list-read-path`: present.

## Verification Commands

```text
pnpm exec tsc --noEmit
```

Result: PASS.

```text
pnpm run build
```

Result: PASS.

## Runtime Scenario

1. Start app from the accepted ECS-006 baseline.
2. Use an isolated copy of the accepted ECS-006 Chrome profile.
3. Normalize restored Auth state by logging out if the copied profile contains a session.
4. Confirm unauthenticated Products navigation is blocked by Route Guard.
5. Login with the approved local Firebase test user.
6. Navigate to Products.
7. Confirm the ECS-006 Product renders.
8. Inspect Product localStorage keys and sanitized Product record fields.
9. Compare Product storage before and after inspection.

## Runtime Result

- Runtime verification: PASS.
- Route Guard active: yes.
- Login succeeds: yes.
- Products route accessible after login: yes.
- Product list renders: yes.
- ECS-006 product renders: yes.
- Product storage key: `products`.
- Product storage is global: yes.
- Product data changed during inspection: no.
- Console errors: 0.
- Page exceptions: 0.

## Storage Evidence

- Product storage keys observed: `products`.
- Account-scoped Product keys observed: none.
- Product record count: 1.
- ECS-006 Product present: yes.
- Product record has `id`: yes.
- Product record has product name/title: yes.
- Product record has price fields: yes.
- Product record has `accountId`: no.
- Product record has `createdBy`: no.
- Product record has `updatedBy`: no.
- Storage hash before inspection: `d184912554a4961d768447bfe9cb933312118c706e42c11484a1dee946e0507b`.
- Storage hash after inspection: `d184912554a4961d768447bfe9cb933312118c706e42c11484a1dee946e0507b`.
- Storage length before inspection: 439.
- Storage length after inspection: 439.

## Evidence Files

```text
outputs/V1-PER-003/runtime.json
outputs/V1-PER-003/dom.json
outputs/V1-PER-003/console.log
outputs/V1-PER-003/storage-snapshot-sanitized.json
outputs/V1-PER-003/screenshot.png
```

## Tool Attempt Notes

Two runtime attempts were discarded before final evidence:

- A Node child-process invocation attempt failed before app evidence because spawning `pnpm.cmd` directly from Node on Windows returned `EINVAL`.
- A route-guard measurement attempt showed that the copied ECS-006 browser profile could restore an existing Firebase session, so the final scenario explicitly normalized Auth state by logging out before proving unauthenticated Products blocking.

These were TOOL / verification invocation issues, not application source failures.

## Scope Confirmation

- No source files changed.
- No Product source files changed.
- No persistence source files changed.
- No Auth source files changed.
- No Route Guard changes.
- No localStorage migration.
- No account-scoped persistence implementation.
- No Product data deletion.
- No Product schema change.
- No Product create/edit/delete implementation.
- No credentials printed.
- No `.env` values printed.
- `.env` remains untracked.

## Result

V1-PER-003 verification passed for an INF assessment mission.
