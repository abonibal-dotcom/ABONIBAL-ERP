# V1-SYNC-007H Runtime Validation

## Environment

- Mission: V1-SYNC-007H - Atomic Commercial Publication and Visibility Foundation
- Branch: `v1/sync-007h-atomic-commercial-publication-visibility-foundation`
- Base tag: `v1-sync-007g-canonical-return-allocation-transaction`
- Local OS: Windows / PowerShell
- Local Node: `24.18.0`
- Declared Functions runtime: Node `22`
- Firebase Emulator project identifier: `abonibal-erp-test`
- Live Firebase target: none
- Production touched: NO

The Functions build emits the known local engine warning because local Node 24
differs from the declared Node 22 runtime. No deployment-runtime claim is made.

## Focused Results

| Validation | Result |
| --- | --- |
| Functions TypeScript/build | PASS |
| Functions unit suite | PASS, 57/57 across 9 files |
| Allocation commit unit coverage | PASS |
| Receipt Rules/Admin Emulator | PASS, 3/3 |
| Allocation Emulator regression | PASS, 9/9 |
| Publication Emulator | PASS, 7/7 |
| Allocation commit transaction | PASS |
| Reserved-to-committed aggregate transition | PASS |
| Complete Phase B account-root update | PASS |
| Exact retry | PASS |
| Conflicting deterministic movement | PASS |
| Crash after allocation commit | PASS |
| Partial marker detection | PASS |
| Client receipt/allocation/marker writes | DENIED |
| Client executed Return write | DENIED |
| Direct client commercial movement create | ALLOWED; trusted gate pending |

The three Emulator files must run as isolated suites because each owns and
clears its Emulator database. A combined parallel Vitest invocation causes test
fixture interference; each isolated command passed.

## Regression Results

| Suite | Result |
| --- | --- |
| V1-SYNC-004 | PASS, 18/18 |
| V1-SYNC-004A | PASS, 26/26 |
| V1-SYNC-005 | PASS, 31/31; rules 36/36 |
| V1-SYNC-006B | PASS, 14/14 |
| V1-SYNC-006D | PASS, 24/24 |
| V1-SYNC-006E | PASS, 39/39 via non-mutating Node 24 `require` bootstrap |
| V1-SYNC-006 | PASS, 41/41; rules 17/17 |
| V1-SYNC-007A | PASS, 6/6 |
| V1-SYNC-007B | PASS, 31/31 |
| V1-SYNC-007C | PASS, 14/14; rules 21/21 |
| V1-SYNC-007DA | PASS, 15/15 |
| V1-SYNC-007D | PASS, 16/16; rules 17/17 |
| V1-SYNC-007F receipt foundation | PASS |
| V1-SYNC-007G allocation foundation | PASS |

## Runtime and Side Effects

- Callable/handler registration: `0`
- Browser runtime source changes: `0`
- Operational live RTDB reads/writes/listeners: `0 / 0 / 0`
- Synthetic Emulator writes: isolated TEST fixtures only
- Existing user records uploaded: `0`
- Migration/backfill: `NONE`
- Rules deployment: NO
- Functions deployment: NO
- Hosting deployment: NO
- Authenticated browser runtime: not opened; console/page metrics not claimed
- Default SyncMode: `disabled`
- Production touched: NO
