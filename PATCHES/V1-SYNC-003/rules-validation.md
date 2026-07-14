# V1-SYNC-003 Rules Validation

## Target And Deployment

- Firebase project: `abonibal-erp-test`
- Database instance: TEST default RTDB
- Config: `firebase.test.json`
- Rules: `database.test.rules.json`
- Dry-run syntax validation: PASS
- Database Rules deployment: PASS
- Deployed rules match tracked rules: PASS
- Production touched: NO

Deployment command:

```text
firebase deploy --only database --config firebase.test.json --project abonibal-erp-test
```

## Validation Method

Authenticated authorization behavior was tested with the Firebase Realtime
Database Emulator and synthetic, non-owner identifiers. The emulator loaded the
same tracked rules file that was deployed. After deployment, the deployed rules
were read through the administrative CLI into a temporary file, normalized,
compared with the tracked rules, and deleted from the temporary directory.

Live unauthenticated HTTP probes were also run against TEST and produced denied
responses. No user token, UID, account ID, email, or credential was exposed.

## Security Matrix

| Gate | Result |
| --- | --- |
| Own account authenticated read | PASS |
| Own account authenticated record create | PASS |
| Foreign account read | DENIED / PASS |
| Foreign account write | DENIED / PASS |
| Unauthenticated read, emulator | DENIED / PASS |
| Unauthenticated write, emulator | DENIED / PASS |
| Unauthenticated read, deployed TEST | DENIED / PASS |
| Unauthenticated write, deployed TEST | DENIED / PASS |
| Client membership create | DENIED / PASS |
| Client membership update | DENIED / PASS |
| Client membership delete | DENIED / PASS |
| Client membership read | DENIED / PASS |
| Firebase UID used as account root | DENIED / PASS |
| Record hard delete | DENIED / PASS |
| Record ID/path mismatch | DENIED / PASS |
| Record account/path mismatch | DENIED / PASS |
| Existing record identity mutation | DENIED / PASS |
| Existing record silent overwrite | DENIED / PASS |

## Data Safety

- Active membership remained present after deployment: YES.
- Operational account roots after validation: 0.
- Permanent security canary data created in TEST: NO.
- Operational Product, Invoice, Payment, or other records created: NO.
- localStorage changed or cleared: NO.
- Firebase UID used as `accountId`: NO.
- Runtime source changes: NONE.
