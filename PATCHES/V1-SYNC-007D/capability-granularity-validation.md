# InvoiceReturn Capability Granularity Validation

## Runtime Matrix

| Route | Capability | Transport | Result |
| --- | --- | --- | --- |
| `invoiceReturns:create:createRecorded` | PRESENT | PRESENT | eligible |
| `invoiceReturns:update:updateRecorded` | PRESENT | PRESENT | eligible |
| `invoiceReturns:update:execute` | ABSENT | ABSENT | blocked |
| `invoiceReturns:create` | ABSENT | ABSENT | blocked |
| `invoiceReturns:update` | ABSENT | ABSENT | blocked |

## Exact Matching Results

- `createRecorded` matches only its exact capability and transport: PASS
- `updateRecorded` matches only its exact capability and transport: PASS
- `execute` matching `updateRecorded`: DENIED
- `execute` resolving `updateRecorded` transport: DENIED
- Specific-to-generic capability fallback: DENIED
- Specific-to-generic transport fallback: DENIED
- Capability without exact transport: BLOCKED
- Transport without exact capability: BLOCKED
- InvoiceReturn execution group cloud-capable: NO
- Commercial `sale_return` leak: 0

Legacy operations without `cloudAction` retain their existing legacy route behavior. No existing outbox checksum was rewritten.
