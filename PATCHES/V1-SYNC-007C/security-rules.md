# TEST RTDB Security Rules

## Deployment Boundary

Rules were validated in the Firebase Database Emulator and deployed only with:

`firebase deploy --only database --config firebase.test.json --project abonibal-erp-test`

No Hosting, Functions, Storage, Firestore, Auth, or production deployment was performed.

## Invoice Rules

The TEST rules add `accounts/$accountId/invoices/$invoiceId` while preserving account-membership authorization and default deny.

Rules enforce:

- authenticated membership for the logical account
- Invoice ID/path and account ID/path consistency
- create-only initial draft revision
- exact revision increment on updates
- draft-only update and tombstone
- approved `draft -> issued -> cancelled` lifecycle
- required operation, idempotency, revision, and checksum metadata
- line schema and stable commercial line values during issue/cancellation
- issued and cancelled lifecycle immutability
- physical delete denial
- cross-account and unauthenticated denial
- client membership mutation denial

Rules do not claim to validate stock sufficiency, totals across collections, grouped publication completeness, or global document-number uniqueness. Those require trusted application/transaction boundaries.

## Emulator Results

- V1-SYNC-005 master-data rules: PASS 36/36
- V1-SYNC-006 StockMovement rules: PASS 17/17
- V1-SYNC-007C Invoice rules: PASS 21/21

Invoice coverage includes draft create/read/CAS, stale and blind overwrite denial, issue, issued core edit denial, cancellation, terminal-state denial, tombstone, physical delete denial, foreign account denial, unauthenticated denial, and membership mutation denial.

Operational live RTDB record writes: 0. Only TEST Database Rules were deployed.
