# KestrelMesh — Request diagnostics (Phase 7)

The root-only **API Activity** workspace shows the most recent authenticated, mutating API requests and their HTTP result, duration, anonymous credential ID, and correlation ID. The Worker sets `X-Request-ID` on API responses. No authorization values, bodies or query strings are persisted. SQL migration `0005_operations.sql` creates the `api_activity` journal.

Routes: `GET /api/ops/summary`, `GET /api/ops/activity?limit=50&before=<ISO-8601>`, and destructive `POST /api/ops/prune` with `{"older_than_days":90,"confirm":"DELETE_OLD_ACTIVITY"}`. Root administrator only. The UI exports the **loaded** page, not the entire database.

This is **best-effort operational diagnostics**, not an immutable, comprehensive, security-event, or compliance-grade audit system. Authentication failures are excluded; write actions may complete if telemetry insertion fails; no multi-tenant actor attribution exists yet. The journal will grow until explicitly pruned. Account data remains subject to Cloudflare free-tier limits. Do not represent the metrics as a formal SLO.

Before production enterprise use, require a durable audit pipeline, append-only off-site retention, per-tenant identity, alert delivery and security review.
