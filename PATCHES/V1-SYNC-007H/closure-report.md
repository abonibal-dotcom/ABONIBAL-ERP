# V1-SYNC-007H Closure Report

## Mission

- Name: V1-SYNC-007H - Atomic Commercial Publication and Visibility Foundation
- Classification: Trusted Functions Foundation / Atomic Commercial Visibility
- Base tag: `v1-sync-007g-canonical-return-allocation-transaction`
- Branch: `v1/sync-007h-atomic-commercial-publication-visibility-foundation`
- Firebase target: Emulator identified as `abonibal-erp-test` only

## Changed Files

- Allocation types, aggregate parser, commit evaluator/repository/service.
- Internal publication types, deterministic plan builder, repository, and service.
- Functions package test script and focused unit/Emulator tests.
- In-memory allocation test repository.
- `PATCHES/V1-SYNC-007H/**` evidence.

Runtime browser source, Firebase Rules, Firebase config, callables, handler
registry, and production configuration were not changed.

## Accepted Foundation

Phase A transactionally commits the existing reservation, preserves immutable
reservation evidence, and derives reserved/committed quantities without
exceeding sold quantity. Phase B requires that exact commit and atomically
publishes the executed InvoiceReturn, every deterministic `sale_return`, the
accepted receipt, and the committed group marker with one account-root update.

Publication ID is the stable command ID. Return and movement IDs do not depend
on the human document number. A `CanonicalDocumentNumberProof` is mandatory,
but no number allocator is implemented. Exact retry is idempotent. Changed
payloads, missing members, divergent markers, stale baselines, receipt lease
loss, and movement identity collisions preserve conflict evidence.

## Security and Visibility

Client writes to receipt, allocation, commit marker, and executed Return paths
are denied by existing TEST Rules. Current Rules still allow an account member
to create a valid commercial StockMovement directly. This is documented as:

`TRUSTED COMMERCIAL STOCKMOVEMENT RULE GATE: PENDING`

No Rules were modified or deployed. No callable, execution handler, transport,
or runtime capability was registered. The foundation therefore performs no
operational write by itself.

## Validation

- `git diff --check`: PASS.
- Functions TypeScript/build: PASS.
- Functions unit tests: PASS `57/57`.
- Receipt Emulator: PASS `3/3`.
- Allocation Emulator: PASS `9/9`.
- Publication Emulator: PASS `7/7`.
- All required V1-SYNC-004 through V1-SYNC-007G regressions: PASS.
- Browser TypeScript/build: PASS.
- Operational live RTDB writes/listeners: `0 / 0`.
- Existing records uploaded: `0`.
- Migration/backfill: `NONE`.
- Production touched: NO.

## Deferred Gates

- V1-SYNC-007I canonical document-number allocation.
- Trusted InvoiceReturn execute handler integration.
- Trusted-only commercial StockMovement Rules.
- Migration and second-device bootstrap verification.
- Explicit owner-approved canonical cutover.

## Final Result

ACCEPTED locally - V1-SYNC-007H READY FOR ARCHITECT REVIEW.

No push or deployment was performed for this mission. V1-SYNC-007I was not
started.
