# V1-SYNC-007G Security Emulator Validation

## Existing Rule Boundary

`database.test.rules.json` was inspected and not modified. The approved account
root grants member reads, while writes remain default-denied unless an explicit
child module rule grants them. `returnAllocations` has no client write grant.

## Emulator Results

| Check | Result |
| --- | --- |
| Own-account authenticated member direct allocation write | DENIED |
| Foreign-account authenticated member allocation write | DENIED |
| Unauthenticated allocation write | DENIED |
| Foreign-account read | DENIED |
| Admin allocation transaction | PASS |
| Logical account/path consistency | PASS |
| Firebase UID used as `accountId` | NO |
| Database rules changed | NO |
| Database rules deployed | NO |

Tests ran only against the local RTDB Emulator configured for the
`abonibal-erp-test` namespace. Production was not contacted.

## Trusted Runtime Boundary

The allocation service is internal Functions source. No callable was exported,
no operational command handler was registered, and no browser capability or
transport for `invoiceReturn.execute` was added. Existing Auth, App Check, and
membership checks from V1-SYNC-007F remain the required gate before any future
handler integration.
