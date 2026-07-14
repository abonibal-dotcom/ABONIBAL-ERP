# V1-SYNC-001 Firebase Path Audit

## Target Boundary

- Firebase project queried: `abonibal-erp-test`
- Query type: read-only shallow root query
- Explicit CLI target: `--project abonibal-erp-test`
- Production project: NOT QUERIED OR CHANGED
- Wakalat-AlFares: NOT QUERIED OR CHANGED

No Firebase record payload, account id, user id, token, credential, SDK config,
or rule content was printed or copied into this report.

## TEST Realtime Database Result

| Check | Result |
| --- | --- |
| Shallow root read | PASS |
| Root state | EMPTY |
| Top-level data path count | 0 |
| Expected module paths present | 0 of 13 |
| Product data path present | NO |
| Invoice data path present | NO |
| Unknown top-level data paths | 0 |

The laptop Product and Invoice QA records did not reach TEST Realtime Database.
The empty root also shows that none of the other operational modules wrote a
record there.

## Expected Paths Versus Current Paths

The following accepted names exist only as local-storage key prefixes:

- `products:{accountId}`
- `stockMovements:{accountId}`
- `invoices:{accountId}`
- `invoiceReturns:{accountId}`
- `customers:{accountId}`
- `suppliers:{accountId}`
- `payments:{accountId}`
- `purchases:{accountId}`
- `expenses:{accountId}`
- `safes:{accountId}`
- `cashMovements:{accountId}`
- `ledgerAccounts:{accountId}`
- `ledgerEntries:{accountId}`

Current Firebase mapping for these names: NONE.

No account-scoped operational path shape exists in application source. The
exact future cloud shape must be approved before implementation; examples must
not become an accidental contract during this audit.

## Application Firebase Usage

The runtime currently uses Firebase for:

1. Firebase Auth.
2. Firestore lookup of the explicit application account mapping.

The runtime does not initialize Realtime Database. `FirebaseAuthConfig` does not
consume a Database URL, and no operational repository receives a Firebase
client. Consequently:

- Product Firebase write attempted: NO.
- Invoice Firebase write attempted: NO.
- Phone Firebase pull/read attempted: NO.
- Realtime listener attached: NO.
- Unawaited Firebase operational write: NO; there is no write call to await.
- Silent Firebase write failure: NO evidence; the write path is absent rather
  than failing.

## Rules Audit

A read-only metadata check established:

- `.read` rule present: YES.
- `.write` rule present: YES.
- Authentication gate present: YES.
- Auth-user restriction present: YES.

No `permission_denied` error path exists in application source, and the app
makes no Database request that the rules could allow or deny. The current
multi-device failure is therefore not caused by TEST rules.

This does not approve the rules for the future account-scoped sync design. The
current explicit `accountId` mapping lives in Firestore, while Realtime Database
Rules cannot query Firestore documents. A repair design must choose an
authoritative authorization bridge, such as approved custom claims, an RTDB
membership mirror maintained by trusted code, or a trusted backend. It must not
replace `accountId` with Firebase UID.

## Data Safety

- TEST data mutated: NO.
- Laptop local data cleared or changed: NO.
- Firebase rules changed: NO.
- Authentication changed: NO.
- Deployment executed: NO.
- Production touched: NO.
