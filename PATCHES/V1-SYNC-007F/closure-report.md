# V1-SYNC-007F Closure Report

## Mission

V1-SYNC-007F - Trusted Commercial Command and Receipt Foundation.

Classification: Trusted Backend Foundation / Callable Functions / Idempotent Command Receipts.

Base tag: `v1-sync-007e-trusted-commercial-execution-atomic-publication-architecture-plan`.

Branch: `v1/sync-007f-trusted-commercial-command-receipt-foundation`.

Firebase project named by all emulator/config commands: `abonibal-erp-test`.

## Changed Files

- `functions/**`: isolated Functions v2 source, tests, and package configuration.
- `firebase.functions.test.json`: dedicated Functions-only TEST config.
- `pnpm-workspace.yaml` and `pnpm-lock.yaml`: Functions workspace registration and locked dependencies.
- `PATCHES/V1-SYNC-007F/**`: mission evidence and contracts.

Browser `src/**`, operational repositories, Database Rules, Hosting config, `firebase.json`, `firebase.test.json`, and `.firebaserc` were not changed.

## Implementation

- Node.js 22 Firebase Functions v2 TypeScript package.
- Callable exports: `submitCommercialCommand` and `getCommercialCommandReceipt`.
- Admin SDK initialization and account-scoped RTDB repositories.
- Auth, App Check, and membership guard.
- Strict schema version 1 command envelope with 64 KiB payload limit.
- Server-side canonical SHA-256 checksum with browser golden compatibility.
- Receipt path: `accounts/{accountId}/commercialCommandReceipts/{commandId}`.
- Receipt states: processing, accepted, rejected, conflict.
- RTDB transaction claim, bounded processing lease, expiry recovery, and terminal retry behavior.
- Typed exact handler registry with zero runtime operational handlers.
- Safe receipt lookup without raw request payload, UID, token, stack trace, or lease ID.

Unsupported operational commands are rejected before durable claim. `invoiceReturn.execute`, `invoice.issue`, and `invoice.cancel` remain unregistered.

## Validation

| Gate | Result |
| --- | --- |
| `git diff --check` | PASS |
| Browser TypeScript | PASS |
| Browser build | PASS |
| Functions TypeScript/build | PASS |
| Foundation unit tests | PASS, 26/26 |
| Auth guard | PASS |
| App Check boundary | PASS in source/tests; project configuration gate documented |
| Membership and cross-account guard | PASS |
| Canonical compatibility | PASS |
| Atomic claim | PASS |
| Exact retry | PASS |
| Conflicting retry | PASS |
| Lease recovery | PASS |
| Receipt lookup | PASS |
| Client direct receipt write | DENIED |
| RTDB emulator tests | PASS, 3/3 |
| Functions emulator smoke | PASS |
| Historical sync regressions | PASS |

The local emulator used host Node 24 while the deployable package and Firebase config target Node 22. No deployment occurred. The currently published stable `firebase-functions` package selected was 7.3.0; the registry's newer `latest` dist-tag was a release candidate and was not adopted.

## Safety Results

- Operational command handlers registered: 0.
- InvoiceReturn execute handler/capability/transport: ABSENT.
- Browser runtime source changes: NONE.
- Operational repositories modified: NO.
- Database Rules modified/deployed: NO/NO.
- Functions deployed: NO.
- Hosting deployed: NO.
- Operational live RTDB writes/listeners: 0/0.
- Existing records uploaded: 0.
- Migration/backfill: NONE.
- Default `SyncMode`: disabled.
- Firebase UID used as accountId: NO.
- Production touched: NO.

## Known Gates

- App Check must be configured and validated in TEST before any Functions deployment or client integration.
- No allocation, publication, numbering, InvoiceReturn execution, Invoice issue, or Invoice cancellation handler exists.
- V1-SYNC-007G must not begin without owner review of this foundation.

## Final Result

ACCEPTED - V1-SYNC-007F is ready for architecture review. No push was performed for this mission.
