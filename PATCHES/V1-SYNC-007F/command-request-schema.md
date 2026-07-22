# Commercial Command Request Schema

## Envelope

Schema version 1 contains only:

- `schemaVersion`
- `accountId`
- `commandId`
- `commandType`
- `targetId`
- `payload`
- optional `clientRequestChecksum`

Unknown top-level fields, unsupported schema versions, malformed IDs, malformed command types, non-object payloads, non-finite numbers, excessive nesting, and payloads above 64 KiB are rejected.

`commandId` and `targetId` are stable technical identities. Human Invoice and Return numbers are not command identities.

## Canonical Server Checksum

The server normalizes JSON and hashes this exact canonical object with SHA-256:

```text
schemaVersion + accountId + commandId + commandType + targetId + payload
```

Volatile timestamps, attempt numbers, transport metadata, and the optional client checksum are excluded. A supplied client checksum is comparison-only and a mismatch is rejected.

## Browser Compatibility

The Functions implementation is independent from Vite/browser runtime code. Golden tests import the existing browser `CanonicalJson` only from the test harness and prove identical canonical text and SHA-256 output for nested objects, arrays, reordered fields, booleans, nulls, and finite numbers.

Results:

- Golden canonical vectors: PASS.
- Same semantic request produces the same checksum: PASS.
- Field ordering does not change checksum: PASS.
- Different payload changes checksum: PASS.
- Browser/server canonical compatibility: PASS.
