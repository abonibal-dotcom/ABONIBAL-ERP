# Auth, App Check, and Membership Contract

## Authentication

Every callable requires `request.auth.uid`. Firebase UID is used only as the authenticated principal and membership key. It is never derived into, substituted for, or compared as the logical `accountId`.

Missing Auth is rejected before request processing, receipt creation, or handler execution.

## App Check

Both exported callables set `enforceAppCheck: true`, and the application guard also requires a verified callable App Check context. Unit tests prove a missing assertion is rejected before membership lookup.

The browser application currently contains no App Check initialization, and no remote App Check configuration or debug token was created or inspected in this mission. Therefore App Check readiness remains a mandatory configuration gate before any Functions deployment or client integration. This mission performs no deployment.

## Logical Account Membership

After request shape validation, the trusted guard reads:

`accountMembers/{accountId}/{firebaseUid}`

through the Admin SDK and requires the value to equal `true`.

The account ID is explicit, syntax-validated, and independent from Firebase UID. Missing membership and foreign-account requests are denied. The trusted runtime does not self-provision membership and has no account fallback.

## Validation Evidence

| Gate | Result |
| --- | --- |
| Auth present | PASS |
| Missing Auth denied | PASS |
| App Check boundary | PASS in source/unit tests; project configuration gate remains |
| Own-account membership | PASS |
| Missing membership | DENIED |
| Foreign account | DENIED |
| Malformed account ID | DENIED |
| Firebase UID fallback | 0 |

The Functions emulator loaded both callables and denied unauthenticated requests. Authenticated App Check and membership permutations were exercised with injected unit-test contexts; no credentials, UID values, or tokens were printed or persisted.
