# Functions and Emulator Validation

## Environment

- Repository: ABONIBAL-ERP
- Branch: `v1/sync-007f-trusted-commercial-command-receipt-foundation`
- Firebase target identifier: `abonibal-erp-test`
- Functions runtime target: Node.js 22
- Local host Node.js: 24.18.0; Firebase emulator documented and displayed this host-runtime substitution
- Firebase CLI: 15.22.3
- Package manager: pnpm 11.10.0
- Deployment: none

## Foundation Tests

Vitest result: 26/26 PASS across six files.

Coverage includes request validation, browser/server canonical compatibility, Auth/App Check/membership guards, exact handler registry matching, unsupported-command pre-claim rejection, concurrent claim, exact terminal retries, conflicting retry, lease recovery, failure injection, safe lookup, and absence of raw tokens/payload/UID in receipts.

## RTDB Emulator

The existing TEST rules were loaded without modification.

| Check | Result |
| --- | --- |
| Authenticated member direct receipt write | DENIED |
| Foreign-account direct receipt write | DENIED |
| Unauthenticated direct receipt write | DENIED |
| Admin repository claim/complete | PASS |
| Concurrent exact claim | One acquired, one processing |
| Conflicting checksum claim | CONFLICT |
| Exact terminal retry | PASS |

Rules test result: 3/3 PASS.

## Functions Emulator

The emulator loaded:

- `submitCommercialCommand`
- `getCommercialCommandReceipt`

Both rejected unauthenticated callable requests. Non-used Firebase service hosts were pointed at local non-listening emulator addresses during this smoke, and neither callable reached Admin data access.

Authenticated App Check and membership combinations were validated through injected unit contexts rather than credentials. This is a documented emulator limitation, not a claim of configured project App Check.

## Regression

PASS:

- V1-SYNC-004 and V1-SYNC-004A.
- V1-SYNC-005 plus 36/36 rules checks.
- V1-SYNC-006B, V1-SYNC-006D, V1-SYNC-006E, and V1-SYNC-006 plus 17/17 rules checks.
- V1-SYNC-007A, V1-SYNC-007B, V1-SYNC-007C plus 21/21 rules checks.
- V1-SYNC-007DA and V1-SYNC-007D plus 17/17 rules checks.

Browser TypeScript and production build passed. Authenticated browser automation was not opened because browser runtime source was unchanged and no credentials are handled by this mission. Console and page-exception metrics are therefore not claimed.

Operational live RTDB writes: 0. Existing user records uploaded: 0. Production touched: NO.
