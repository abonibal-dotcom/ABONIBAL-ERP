# InvoiceReturn Recorded Deletion Boundary

The current InvoiceReturn domain exposes no delete method and no delete UI for recorded records. V1-SYNC-007D preserves that contract.

- Recorded delete API: NONE
- Recorded delete UI: NONE
- Tombstone lifecycle: N/A
- Tombstone operation: NOT REGISTERED
- Tombstone capability: NOT REGISTERED
- Tombstone transport: NOT REGISTERED
- Physical cloud delete: DENIED
- Executed hard delete: DENIED

No new deletion lifecycle was invented. If a future business requirement introduces removal or withdrawal of a recorded Return, it requires a separate approved domain and audit contract.
