# KestrelMesh — Phase 12 Spatial Intelligence Console

## What's new
- Distinct, interactive spatial data canvas with semantic HTML controls, keyboard focus and desktop/mobile styling.
- Search within loaded results; multi-term matching across returned fields, without submitting record data to an external service.
- Stable sorting of returned rows by textual, numeric and temporal columns; layout retains column state for the active session.
- Spatial nodes open the exact same authenticated source inspector as the list/table modes.
- Charts never fabricate throughput, numeric metrics, timestamp values, or links. Missing measurements produce an explicit empty state.
- Network edges exist only where an explicit reference value matches another returned record identifier.
- Respects reduced-motion and forced-colors preferences; retains navigation, card/grid/timeline modes, selection and formula-safe export.

## Scope and security
This is a presentation and local analytical enhancement, not a claim of production-grade multi-tenancy or full-database aggregation. Record sets are bounded by the existing API response; the canvas renders at most 32 network nodes or data points for clarity. Search uses a bounded number of literal terms, never a user-provided regular expression. Record strings are HTML-escaped by the shared application escape function. UI state never stores record bodies in localStorage.

## Verification
- `npm run check`
- `npm test` (includes 5 Phase 12 regression cases per app)
- Live deployment verification asserts `/operational-map.js`, `/command-surface.css` and HTML asset references.
- Headless Chromium fixture interactions check canvas selection, search, sorting and a 390px viewport; these do not substitute for a fully authenticated production-browser test.

## Follow-on enterprise tasks
Server-side cursor pagination and filtering, organization-scoped RBAC, realtime state subscriptions, comprehensive visual regression and accessible browser E2E, performance profiling, data retention and backup policy, and external security assessment.
