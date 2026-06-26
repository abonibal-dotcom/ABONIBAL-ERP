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

### PATCH-000-ECS-003A - Dashboard Copy Stabilization

- Removed internal implementation/progress copy from the Dashboard page.
- Kept the Dashboard route, layout ownership, and user-facing welcome copy unchanged.
- Verified the Dashboard with DOM-based runtime evidence, clean browser console, and no page exceptions.

### PATCH-000-ECS-004 - Dashboard Text Encoding Investigation

- Investigated the Dashboard text encoding hypothesis with runtime evidence.
- Rejected the hypothesis because the Dashboard rendered valid Arabic text at runtime.
- Closed ECS-004 without source-code changes.
