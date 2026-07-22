# Mutation-Specific Capability Contract

## Purpose

V1-SYNC-007DA closes the capability ambiguity where two mutations share the
same sync module and operation type but require different cloud readiness.
The motivating case is `invoiceReturns:update`, which may represent either a
future recorded-state update or the commercial `execute` transition.

## Route Identity

`SyncOperation` now has an optional `cloudAction` token.

| Operation form | Capability route |
| --- | --- |
| Legacy operation without `cloudAction` | `{module}:{operationType}` |
| Mutation-specific operation | `{module}:{operationType}:{cloudAction}` |

The token must be a safe non-empty identifier beginning with a lowercase
letter and containing only ASCII letters or digits.

## Matching Rules

- Legacy registrations keep their existing module/operation-type behavior.
- A mutation-specific operation requires an exact specific capability.
- A generic capability never satisfies an operation carrying `cloudAction`.
- A capability for one action never satisfies another action on the same
  module and operation type.
- Duplicate registration of the same specific capability is idempotent.

Capability is necessary but not sufficient for cloud dispatch. The exact
transport route must also be registered.

## Current Commercial Boundary

New InvoiceReturn execution operations declare:

`invoiceReturns:update:execute`

No runtime capability is registered for that route in this mission. A future
recorded-state route may use:

`invoiceReturns:update:updateRecorded`

Registering that future route cannot unlock execution because matching is
exact and there is no specific-to-generic fallback.
