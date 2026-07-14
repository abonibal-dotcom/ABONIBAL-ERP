# V1-SYNC-003 Membership Provisioning

## Provisioning Result

The first V1-SYNC-003 preflight found no RTDB membership entry. Rules deployment
stopped as required and the owner provisioned the membership through a trusted
TEST-only administrative path.

The resumed preflight verified, without displaying identifiers:

- approved TEST Auth user present: YES;
- logical account mapping flow available: YES;
- active RTDB membership entry present: YES;
- membership account roots found: 1;
- active `true` membership leaves found: 1.

No Firebase UID, account ID, email, token, or SDK configuration was printed or
recorded in mission documents.

## Trusted Provisioning Model

Provisioning and deprovisioning are owner/admin operations. The browser client
cannot:

- create a membership;
- grant itself membership;
- update a membership;
- delete a membership;
- read the membership map.

The application does not self-provision membership. Firestore remains the Auth
session account-mapping source; RTDB membership is an authorization mirror for
Realtime Database rules only.

## Safe Sequence Used

1. Confirm the approved TEST Auth user exists.
2. Confirm the existing login flow resolves an explicit logical account.
3. Stop because membership was initially absent.
4. Owner provisions the membership in `abonibal-erp-test` only.
5. Verify an active membership exists without printing its keys.
6. Validate the TEST rules syntax.
7. Deploy only TEST Realtime Database rules.
8. Verify authorized and denied rule paths.
9. Confirm no operational account data was created.

## Revocation Policy

Future revocation must be performed through the same trusted administrative
boundary. Removing or disabling the membership must not delete local cache or
business records and must not redirect the user to another account.
