# Exact Transport Routing Contract

## Registry Behavior

`SyncOperationTransportRegistry` keeps the established module transport map
for legacy operations. It adds a separate exact-route map for operations that
declare `cloudAction`.

Dispatch behavior is deliberately asymmetric:

- No action: route through the legacy module transport.
- Action present: route only through the exact
  `{module}:{operationType}:{cloudAction}` transport.
- Exact route absent: fail with `sync_route_unconfigured`.
- Never fall back from a specific route to a generic module transport.

## Dual Gate

The runtime outbox cloud-capability predicate now requires both:

1. `SyncCloudCapabilityRegistry.supports(operation)`
2. `SyncOperationTransportRegistry.supports(operation)`

Capability without transport remains blocked. Transport without capability
also remains blocked. This prevents registration order or a broad generic
transport from accidentally releasing a mutation-specific group.

## Compatibility

Existing Product, Customer, Supplier, Invoice, and StockMovement operations do
not declare `cloudAction`; they continue to use their existing legacy routes.
No Firebase transport implementation was changed or registered by this
mission.
