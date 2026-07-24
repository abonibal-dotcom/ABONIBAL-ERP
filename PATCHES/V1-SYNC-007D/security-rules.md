# TEST RTDB InvoiceReturn Security Rules

## Deployment Boundary

Rules were validated in the Firebase Realtime Database Emulator and deployed only with:

`firebase deploy --only database --config firebase.test.json --project abonibal-erp-test`

No Hosting, Functions, Storage, Firestore, Auth, or production deployment was performed.

## Enforced Contract

The TEST rules add `accounts/$accountId/invoiceReturns/$returnId` while preserving membership authorization and default deny.

Rules enforce:

- authenticated membership for the logical account
- account ID/path and Return ID/path consistency
- create only as `recorded` at initial revision
- recorded-to-recorded update with exactly one revision increment
- stable Return, Invoice reference, creation, and existing line identities
- required schema, operation, idempotency, checksum, and lifecycle metadata
- `recorded -> executed` denial
- executed edit denial
- physical delete denial
- cross-account denial
- unauthenticated denial
- client membership mutation denial

Rules do not claim to validate cumulative returned quantity across records, inventory totals, global Return-number uniqueness, or durable group completeness. Those require trusted canonical transaction/application boundaries.

## Emulator Results

- V1-SYNC-007D InvoiceReturn rules: PASS 17/17
- V1-SYNC-007C Invoice rules regression: PASS 21/21
- V1-SYNC-006 StockMovement rules regression: PASS 17/17
- V1-SYNC-005 master-data rules regression: PASS 36/36

TEST Database Rules deployment: PASS. Operational live RTDB record writes: 0. Existing user records uploaded: 0. Production touched: NO.
