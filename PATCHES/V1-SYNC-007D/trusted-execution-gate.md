# Trusted InvoiceReturn Execution Gate

## Deliberate Gate

InvoiceReturn execution remains local-only. The route `invoiceReturns:update:execute` has no runtime capability and no cloud transport.

Runtime registration is limited to:

- `invoiceReturns:create:createRecorded`
- `invoiceReturns:update:updateRecorded`

Exact mutation-specific matching prevents `execute` from falling back to either a generic `invoiceReturns:update` route or the `updateRecorded` route.

## Durable Group Result

An InvoiceReturn execution group contains one `invoiceReturns:update:execute` member followed by deterministic `stockMovements:append` members. Because the execute member is not cloud-capable, the whole group remains cloud-blocked even though StockMovement transport exists.

- Execute dispatch: 0
- Commercial `sale_return` dispatch before execute capability: 0
- StockMovement sibling leak: 0
- Business command replay: 0

Local disabled-mode execution remains functional under the existing durable commercial command and cumulative validation contracts.

## Why Cutover Remains Blocked

Local cumulative over-return validation passes, but two stale devices can still validate separate Returns against the same older sold quantity. Recorded-state CAS does not provide a trusted cumulative allocation transaction across Return records.

- Concurrent stale-device over-return solved: NO
- Trusted execute capability: ABSENT
- Trusted execute transport: ABSENT
- Full multi-device Return execution: BLOCKED
- Multi-device Return numbering solved: NO
