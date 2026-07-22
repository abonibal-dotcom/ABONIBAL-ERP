# InvoiceReturn Execution Safety

## Root Gap Closed

Before this mission, both recorded-state mutation and execution could be
represented as `invoiceReturns:update`. Capability matching used only module
and operation type, while transport dispatch selected only by module. A future
generic InvoiceReturn registration could therefore release commercial
execution unintentionally.

## Safe Execution Marker

New execution group members now declare:

`cloudAction: execute`

Their exact route is:

`invoiceReturns:update:execute`

The legacy payload reader remains conservative: old durable execution members
without the action remain readable and are not rewritten. New members must
retain the declared action during identity validation.

## Runtime State After V1-SYNC-007DA

- InvoiceReturn execute capability registered: `NO`
- InvoiceReturn execute transport registered: `NO`
- InvoiceReturn execution group cloud-capable: `NO`
- Generic InvoiceReturn capability can release execution: `NO`
- Recorded-state capability can release execution: `NO`
- Commercial `sale_return` movement leak: `0`

No InvoiceReturn repository integration, Firebase transport, Firebase rule,
deployment, migration, or historical upload was added. V1-SYNC-007D remains
blocked until its mutation-specific capability and transport can be registered
explicitly under a reviewed mission.
