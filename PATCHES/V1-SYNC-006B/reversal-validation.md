# V1-SYNC-006B Reversal Validation

## Focused Smoke Result

Command:

```text
pnpm dlx tsx scripts/v1-sync-006b-stock-movement-reversal-smoke.ts
```

Result: PASS, 14/14.

| # | Check | Result |
| --- | --- | --- |
| 1 | Legacy normal and voided records remain byte-stable on read | PASS |
| 2 | Legacy voided movement cannot create a synthetic reversal | PASS |
| 3 | Positive movement reversal is immutable, opposite, and deterministic | PASS |
| 4 | Exact retry returns one reversal and changed retry conflicts | PASS |
| 5 | Concurrent-like same-account services create one reversal effect | PASS |
| 6 | Negative movement reverses to a positive exact effect | PASS |
| 7 | Repository exposes no mutable void or hard-delete API | PASS |
| 8 | Opening stock creates once and reverses once | PASS |
| 9 | Mixed legacy and V2 ledger preserves historical quantity | PASS |
| 10 | Commercial sale movements remain domain-owned | PASS |
| 11 | Cross-account reversal cannot see another account movement | PASS |
| 12 | Invoice issue and return preserve their domain movement flow | PASS |
| 13 | Manual creation cannot bypass the reversal service | PASS |
| 14 | Sync remains disabled with no Firebase integration | PASS |

## Reversal Invariants

### Positive original

```text
original: +10
reversal: -10
net: 0
```

- original serialized payload unchanged: PASS;
- deterministic reversal ID: PASS;
- stable idempotency key: PASS;
- original account/product retained: PASS;
- reason and original reference retained: PASS.

### Negative original

```text
original: -3
reversal: +3
net: 0
```

Result: PASS.

### Retry and duplicate behavior

- exact retry returns the existing reversal ID: PASS;
- retry with a different reason returns a conflict/failure: PASS;
- two service instances sharing one account cache return one reversal: PASS;
- reversal count for the original: `1`;
- duplicate inventory effect: `0`;
- reversal-of-reversal: rejected.

## Repository Immutability

- `voidForAccount` available: NO;
- inherited/public `clear` available: NO;
- update API available: NO;
- physical delete API available: NO;
- identical append: idempotent MATCH;
- same ID with different quantity: conflict;
- original after conflict: unchanged.

## Opening Stock

- first opening movement: PASS;
- same opening request: returns existing movement;
- opening movement count before reversal: `1`;
- one reversal appended: PASS;
- original remains stored: PASS;
- derived quantity after reversal: `0`;
- cross-record distributed transaction added: NO.

## Invoice And Return Regression

The smoke uses real `InvoiceService` and `InvoiceReturnService` instances over
the same in-memory account-scoped repositories.

- opening stock: `10`;
- invoice issue quantity: `2`;
- issued status: PASS;
- one `sale_deduction` created: PASS;
- quantity after issue: `8`;
- generic reversal of sale deduction: rejected;
- one recorded/executed invoice return quantity: `1`;
- one `sale_return` created: PASS;
- quantity after return: `9`;
- generic `reversal` created for sale deduction: `0`;
- Product legacy quantity before/after: `777` / `777`.

No Invoice, InvoiceReturn, or Product repository source file was changed.

## Sync Foundation Regression

Existing smoke suites were rerun:

| Suite | Result |
| --- | --- |
| V1-SYNC-004 foundation | PASS, 18/18 |
| V1-SYNC-004A durable capture | PASS, 26/26 |
| V1-SYNC-005 master-data sync | PASS, 31/31 |

The prior suites confirm zero operational Firebase reads/writes for disabled
foundation startup, no command replay, account boundaries, no historical scan,
and default SyncMode `disabled`.

## Cloud Boundary

- StockMovement Firebase repository/bridge: NOT ADDED;
- StockMovement RTDB adapter/listener: NOT ADDED;
- operational StockMovement RTDB writes: `0`;
- operational StockMovement RTDB listeners: `0`;
- existing StockMovement auto-upload: `0`;
- migration/backfill: NONE;
- production touched: NO.
