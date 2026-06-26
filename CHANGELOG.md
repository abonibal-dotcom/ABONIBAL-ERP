# Changelog

## PATCH-000 - Project Stabilization

### PATCH-000-ECS-001 - Route Registry Stabilization

- Stabilized the Sidebar route surface by deriving visible navigation items from the registered route list.
- Removed Sidebar entries that pointed to unregistered routes.
- Verified that navigation to visible routes completes without browser console errors or page exceptions.

### PATCH-000-ECS-002 - Product Page Listener Lifecycle Stabilization

- Stabilized the product page dialog listener lifecycle.
- Replaced anonymous dialog button listeners with retained callback references.
- Added `onLeave()` cleanup for `create-product`, `cancel-product`, and `close-product-dialog`.
- Verified listener stability over 50 navigation/dialog cycles.
