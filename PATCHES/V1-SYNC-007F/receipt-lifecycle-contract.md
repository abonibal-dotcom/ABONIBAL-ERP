# Commercial Command Receipt Lifecycle Contract

## Canonical Path

`accounts/{accountId}/commercialCommandReceipts/{commandId}`

There is no global command path and no Firebase UID in the operational path.

## Stored Schema

The receipt stores stable identity, server request checksum, status, attempt count, timestamps, processing lease metadata, result checksum, safe result summary, safe error code, optional future publication ID, and the relevant terminal timestamp.

It does not store:

- Auth or App Check tokens.
- Firebase UID.
- secrets or credentials.
- the raw request payload.
- stack traces.

Receipt identity is checked against its account-scoped RTDB path on claim, completion, and lookup.

## States

Allowed transitions:

```text
absent -> processing
processing -> accepted
processing -> rejected
processing -> conflict
```

`accepted`, `rejected`, and `conflict` are terminal. Exact terminal retries return the original receipt without handler execution. No terminal state can transition back to processing in this foundation.

## Safe Lookup

`getCommercialCommandReceipt` requires Auth, App Check, explicit logical account ID, and membership. It reads only the requested account receipt and returns no raw payload or processing lease ID. It never executes or resumes a command.

Cross-account lookup is denied by the same membership guard. Missing receipts return `found: false`.

## Client Write Boundary

Existing TEST rules deny authenticated member, foreign member, and unauthenticated direct writes to `commercialCommandReceipts`. The Admin receipt repository writes successfully in the RTDB emulator.

No Database Rules were changed or deployed.
