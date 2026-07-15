# V1-SYNC-007A Legacy Commercial Record Compatibility

## Non-Destructive Policy

This mission performs no startup scan, storage rewrite, ID rewrite, numbering rewrite, migration, backfill, or upload.

Legacy Invoice and InvoiceReturn records remain readable when optional revision, command identity, or line identity metadata is absent. Repositories normalize absent line IDs to an empty in-memory compatibility value only; they do not persist that representation during read.

## Explicit Mutation Policy

- A legacy draft may receive stable line IDs and revision metadata only when the user explicitly edits and saves it.
- A legacy draft with missing/unsafe line identity cannot be issued before that explicit save.
- A legacy issued Invoice is never rewritten automatically.
- A legacy executed Return is never rewritten automatically.
- A legacy Return with missing/unsafe line identity cannot execute a new side effect.
- Existing StockMovement IDs and human document numbers are never changed.

## Conservative Final-Record Behavior

Legacy issued, cancelled, or executed records remain visible and auditable. Exact-retry success is available only when the stored command identity and deterministic movement contract can be proven. Otherwise the service rejects the retry instead of inventing identity or changing history.

## Measurable Gates

- startup rewrite count: `0`;
- historical IDs changed: `0`;
- historical numbers changed: `0`;
- existing records uploaded: `0`;
- migration/backfill: `NONE`.
