# V1-SYNC-007G Closure Report

## Mission

- Name: V1-SYNC-007G - Canonical Return Allocation Reservation Transaction
- Classification: Trusted Backend / Canonical Allocation / Concurrency Safety
- Base tag: `v1-sync-007f-trusted-commercial-command-receipt-foundation`
- Branch: `v1/sync-007g-canonical-return-allocation-transaction`
- Firebase target: `abonibal-erp-test` local Emulator only

## Changed Files

- `functions/package.json`
- `functions/src/allocation/CanonicalCommercialRecordReader.ts`
- `functions/src/allocation/CanonicalReturnAllocationService.ts`
- `functions/src/allocation/FirebaseCanonicalCommercialRecordReader.ts`
- `functions/src/allocation/FirebaseReturnAllocationRepository.ts`
- `functions/src/allocation/ReturnAllocationRepository.ts`
- `functions/src/allocation/ReturnAllocationTransaction.ts`
- `functions/src/allocation/ReturnAllocationTypes.ts`
- `functions/src/allocation/ReturnAllocationValidation.ts`
- `functions/tests/helpers/InMemoryCanonicalCommercialRecordReader.ts`
- `functions/tests/helpers/InMemoryReturnAllocationRepository.ts`
- `functions/tests/unit/CanonicalReturnAllocationService.test.ts`
- `functions/tests/emulator/return-allocation.emulator.test.ts`
- `PATCHES/V1-SYNC-007G/canonical-return-allocation-schema.md`
- `PATCHES/V1-SYNC-007G/allocation-transaction-contract.md`
- `PATCHES/V1-SYNC-007G/multi-line-concurrency-validation.md`
- `PATCHES/V1-SYNC-007G/reservation-recovery-boundary.md`
- `PATCHES/V1-SYNC-007G/existing-data-and-migration-boundary.md`
- `PATCHES/V1-SYNC-007G/security-emulator-validation.md`
- `PATCHES/V1-SYNC-007G/runtime-validation.md`
- `PATCHES/V1-SYNC-007G/closure-report.md`

Browser runtime source, Firebase rules/configuration, Hosting configuration, and
existing operational repositories were not changed.

## Implementation Summary

`CanonicalReturnAllocationService` validates a checksum-bound internal request,
then reads canonical Invoice and InvoiceReturn envelopes through
`FirebaseCanonicalCommercialRecordReader`. Only an issued Invoice and recorded,
revision/checksum-matching Return can reach the repository.

`FirebaseReturnAllocationRepository` performs one Admin RTDB transaction on
`accounts/{accountId}/returnAllocations/{invoiceId}`. It validates the complete
existing aggregate, checks every requested line, and atomically records one
immutable processing reservation plus derived reserved quantities. Sold quantity
comes only from the issued Invoice snapshot.

Exact retries return the same reservation without an increment. Conflicting
command reuse and corrupt canonical state are preserved as conflict evidence.
Duplicate Return-line or Invoice-line identities are rejected conservatively.
Strict finite-number capacity checks add no new rounding contract.

## Receipt and Publication Boundary

V1-SYNC-007F receipt claims remain independent. Runtime operational handlers:
`0`. `invoiceReturn.execute` handler/capability/transport: `ABSENT / ABSENT /
ABSENT`. No accepted operational receipt, executed Return transition,
StockMovement, commercial commit, or document number is created.

The only reservation state is `processing`. Automatic expiry/release is not
implemented. A future trusted recovery/publication mission must explicitly
revalidate, commit, or release the reservation.

## Validation

- `git diff --check`: PASS
- Browser TypeScript/build: PASS / PASS
- Functions TypeScript/build: PASS / PASS
- Functions unit tests: PASS, 51/51
- Allocation Emulator tests: PASS, 9/9
- Receipt rules regression: PASS, 3/3
- Required V1-SYNC regression suites: PASS
- 6 + 6 against sold 10: exactly one reservation; aggregate 6
- 4 + 6 against sold 10: both reservations; aggregate 10
- Multi-line overflow: whole request rejected
- Client direct allocation writes: DENIED
- Cross-account read/write: DENIED
- Admin transaction: PASS

## Safety and Deferred Work

- Existing records scanned/uploaded: `0`
- Migration/backfill: `NONE`
- Operational live RTDB writes/listeners: `0 / 0`
- Database Rules modified/deployed: NO / NO
- Functions deployed: NO
- Hosting deployed: NO
- Browser runtime source modified: NO
- Default SyncMode: `disabled`
- Firebase UID used as logical accountId: NO
- Production touched: NO
- App Check TEST deployment proof remains pending before any Functions deployment.
- Commit/release/publication and callable handler registration are deferred.

## Final Result

ACCEPTED - V1-SYNC-007G READY FOR ARCHITECT REVIEW.
