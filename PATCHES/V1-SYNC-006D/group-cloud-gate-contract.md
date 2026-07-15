# V1-SYNC-006D - Group Cloud Gate Contract

## Eligibility

An ungrouped operation keeps the V1-SYNC-004A rule: pending cloud status plus
locally applied state and an eligible retry time.

A grouped operation is cloud-eligible only when all of these are true:

- its own cloud status is `pending`;
- its own local apply state is `applied`;
- the complete group manifest is valid;
- every required group member is locally applied;
- no member has local conflict or terminal local failure;
- no member has cloud conflict or terminal cloud failure;
- every earlier sequence member is acknowledged.

`getPending()` applies this gate, and `markSyncing()` rechecks it immediately
before changing cloud state.

## Ordering

The foundation is generic and uses `groupSequence` values `1, 2, 3, ...`.
After local completion, only the first sequence is initially eligible. A later
member cannot overtake an earlier member; it unlocks only after the earlier
member is durably acknowledged.

No Product-specific ordering or multi-location Firebase write is implemented.

## Partial Acknowledgement

Grouped acknowledged operations remain present while the group is cloud
partial. Their durable receipts prevent replay. Once all members are
acknowledged, group cleanup removes every member in one account-outbox write.

## Validation Evidence

The fake-transport suite proves:

- one applied member plus a pending sibling is blocked;
- complete local apply unlocks sequence 1;
- sequence 2 waits for sequence 1 acknowledgement;
- group conflict blocks every pending sibling;
- group failure blocks every pending sibling;
- ungrouped processing and cleanup remain unchanged;
- complete grouped acknowledgement cleans the group atomically.

Operational Firebase reads and writes in this mission are both zero. No rules,
listener, deployment, migration, or cutover behavior is introduced.
