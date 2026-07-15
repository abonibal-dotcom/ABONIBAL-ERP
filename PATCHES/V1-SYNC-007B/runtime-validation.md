# V1-SYNC-007B Runtime Validation

## Environment

- Date: 2026-07-16
- Platform: Windows / PowerShell
- Branch: `v1/sync-007b-sales-commercial-durable-group-integration`
- Base tag: `v1-sync-007a-sales-domain-stable-identity-lifecycle-alignment`
- Default `SyncMode`: `disabled`
- Firebase live deployment: none
- Production touched: no

## Technical Gates

| Gate | Result |
| --- | --- |
| `git diff --check` | PASS |
| `pnpm.cmd exec tsc --noEmit` | PASS |
| `pnpm.cmd run build` | PASS |
| Vite production preview | PASS, HTTP 200 at `http://localhost:4173/` |
| Build warning | Known chunk-size warning only |

## Focused Validation

`scripts/v1-sync-007b-sales-commercial-group-smoke.ts`: PASS `31/31`.

| Area | Result |
| --- | --- |
| Invoice issue durable group | PASS |
| Invoice cancellation durable group | PASS |
| InvoiceReturn execution durable group | PASS |
| Complete intent before local mutation | PASS |
| One atomic initial batch call | PASS |
| Crash/partial/marker recovery | PASS |
| Exact retry | PASS |
| Conflicting retry | PASS |
| Group cloud capability gate | PASS |
| Duplicate sale deduction / return | `0 / 0` |
| Business command replay | `0` |
| Commercial cloud dispatch/leak | `0 / 0` |

## Regression Suites

| Suite | Result |
| --- | --- |
| V1-SYNC-004 | PASS `18/18` |
| V1-SYNC-004A | PASS `26/26` |
| V1-SYNC-005 master data | PASS `31/31` |
| V1-SYNC-005 TEST rules emulator | PASS `36/36` |
| V1-SYNC-006B | PASS `14/14` |
| V1-SYNC-006D | PASS `24/24` |
| V1-SYNC-006E | PASS `39/39` |
| V1-SYNC-006 inventory | PASS `41/41` |
| V1-SYNC-006 TEST rules emulator | PASS `17/17` |
| V1-SYNC-007A | PASS `6/6` |

V1-SYNC-006E required an in-memory `createRequire` shim because its accepted
script uses CommonJS `require` under Node 24 ESM. No prior mission file changed.

## Runtime Boundaries

The focused suite covers draft issue, multi-line issue, retry, cancellation,
partial/multiple returns, local over-return, inventory derivation, disabled
mode, and the commercial cloud gate. Existing module regressions cover Product
creation/opening/edit, reversal, Customers/Suppliers, and shared sync behavior.

Authenticated browser control was unavailable for the local preview origin.
Page-by-page navigation, console errors, and page exceptions are therefore
`NOT MEASURED - TOOL LIMITATION`; no zero metrics are inferred. HTTP entry,
TypeScript, build, domain/application integration, rules, and recovery suites
all passed.

## Safety Results

- Invoice/InvoiceReturn Firebase transports: not registered.
- Invoice/InvoiceReturn rules: unchanged.
- Operational live RTDB writes/listeners: `0 / 0`.
- Existing Invoice/InvoiceReturn upload: `0 / 0`.
- Historical group generation / auto-enqueue: `0 / 0`.
- Migration/backfill: `NONE`.
- Concurrent cross-device over-return: not solved.
- Multi-device numbering: not solved.
- `Product.quantity` authoritative: no.
- Production touched: no.
