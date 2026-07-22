# Security and Logging Boundary

## Trusted Data Boundary

- Admin SDK is initialized only inside the Functions package.
- Callable requests require Auth and App Check.
- Account membership is verified explicitly before any command claim or lookup.
- Firebase UID is membership identity only and never `accountId`.
- Receipt and membership paths are account-scoped and path segments are validated.
- Handler lookup is exact and has no generic fallback or payload-directed dispatch.
- Runtime operational handler registry is empty.

## Data Minimization

Receipts persist deterministic checksums and safe summaries, not raw command payloads. They never persist ID tokens, App Check tokens, UID, credentials, stack traces, or Admin configuration.

Safe callable lookup omits the internal processing lease ID. Error mapping returns stable public error codes rather than raw internal exceptions.

## Logging

Foundation source contains no application `console` or logger calls. Therefore it does not log payloads, account IDs, command targets, tokens, credentials, or stack traces. Firebase emulator protocol diagnostics showed verification categories only.

Future operational handlers must use safe correlation fields and must not log commercial payloads or identity values. That work requires separate review.

## Deployment Boundary

- Functions deployment: NO.
- Database Rules deployment: NO.
- Hosting deployment: NO.
- Other Firebase deployment: NO.
- Operational live RTDB writes: 0.
- Production project touched: NO.

The only permitted future Functions deployment command shape is explicit:

```text
firebase deploy --only functions --config firebase.functions.test.json --project abonibal-erp-test
```

It remains forbidden until App Check and subsequent trusted-execution gates receive separate approval.
