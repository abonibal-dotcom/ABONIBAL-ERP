# V1-SYNC-007G Runtime Validation

## Mission

V1-SYNC-007G - Canonical Return Allocation Reservation Transaction

## Environment

- Local OS: Windows / PowerShell
- Local Node: `24.18.0`
- Functions declared runtime: Node `22`
- Package manager: pnpm `11.10.0`
- Firebase data target used by emulator: `abonibal-erp-test`
- Production touched: NO

The Functions build emits the expected local engine warning because validation
ran on Node 24 while the deployment target remains Node 22. This is a LOCAL
TOOLCHAIN DIFFERENCE; no deployed-runtime claim or deployment was made.

## Validation Results

| Validation | Result |
| --- | --- |
| `git diff --check` | PASS |
| Browser `pnpm exec tsc --noEmit` | PASS |
| Browser `pnpm run build` | PASS |
| Functions TypeScript/build | PASS |
| Functions unit suite | PASS, 51/51 across 7 files |
| Allocation unit coverage | PASS, 25 cases included in the suite |
| Allocation RTDB Emulator suite | PASS, 9/9 |
| V1-SYNC-007F receipt rules/Admin regression | PASS, 3/3 |
| Client direct allocation write | DENIED |
| 6 + 6 against sold 10 | PASS, exactly one reserved |
| 4 + 6 against sold 10 | PASS, aggregate 10 |
| Multi-line all-or-nothing | PASS |
| Exact retry | PASS |
| Conflicting retry | PASS |
| Aggregate duplicate increment | 0 |

The browser production build completed with the existing non-blocking chunk-size
warning. No browser runtime source changed.

## Regression Suites

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

## Side-Effect Counts

- InvoiceReturn status transitions: `0`
- StockMovements created: `0`
- `sale_return` records created: `0`
- Commercial group commits: `0`
- Document numbers allocated: `0`
- Accepted operational receipts: `0`
- Operational command handlers registered: `0`
- Operational live RTDB writes/listeners: `0 / 0`
- Migration/backfill: `NONE`
- Functions deployment: NO
- Database Rules deployment: NO
- Hosting deployment: NO

App Check for TEST remains a mandatory pre-deployment gate and was not claimed
as proven by this local-only mission.
