# Trusted Commercial Command Boundary

## Mission

V1-SYNC-007F - Trusted Commercial Command and Receipt Foundation.

## Runtime Boundary

The trusted boundary is an isolated Firebase Functions v2 TypeScript package in `functions/`. It targets Node.js 22 and exports two callable functions:

- `submitCommercialCommand`
- `getCommercialCommandReceipt`

The dedicated `firebase.functions.test.json` contains only the Functions source, codebase, runtime, predeploy build, and Functions emulator port. Any future command must name both `--config firebase.functions.test.json` and `--project abonibal-erp-test` explicitly.

No Functions, Hosting, Database Rules, Auth, Firestore, Storage, or other Firebase resource was deployed in this mission.

## Submission Flow

`submitCommercialCommand` performs these steps:

1. Require Firebase Auth.
2. Require a verified App Check assertion.
3. Validate the request schema and logical account ID.
4. Verify `accountMembers/{accountId}/{firebaseUid} === true` through Admin SDK.
5. Calculate the canonical request checksum on the server.
6. Require an exact trusted handler registration.
7. Atomically claim the account-scoped receipt.
8. Run the exact handler only when the lease is acquired.
9. Finalize the receipt as accepted, rejected, or conflict.

Runtime operational handler count is zero. `invoiceReturn.execute`, `invoice.issue`, and `invoice.cancel` are rejected as `UNSUPPORTED_COMMAND` before a receipt claim, so no command identity is prematurely reserved.

## Scope Exclusions

- No InvoiceReturn allocation or execution.
- No Invoice issue or cancellation execution.
- No StockMovement publication.
- No canonical numbering.
- No commercial commit marker.
- No browser client integration.
- No execute capability or transport.
- No migration or backfill.

The default browser `SyncMode` remains `disabled`, and browser operational source was not modified.
