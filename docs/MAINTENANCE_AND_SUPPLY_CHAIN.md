# Phase 21 — maintenance, locked dependencies and production preflight

- Worker Cron Trigger executes every day at 04:00 UTC (`0 4 * * *`); no external cron provider, API token, or paid service required.
- The Cloudflare `scheduled()` event deletes quota counters **strictly older than 24 hours**. Recent counters remain available for atomic per-credential limits.
- A D1 row in `maintenance_status` records the most recent success timestamp and pruned row count. Root-only `GET /api/access/maintenance` exposes status, not credentials.
- There is **no unauthenticated maintenance HTTP endpoint**. Errors during scheduled execution propagate to Cloudflare, where failure can be inspected.
- The source-controlled `package-lock.json` pins npm transitive versions and SHA-512 package integrity. CI and deployment must use `npm ci` and `npm run verify:release`.
- `verify:release` replays migration SQL on a fresh SQLite database and checks integrity, foreign keys and required security tables. A fresh-database preflight is not a backup, and cannot replace staging migration testing on production-like data.
- Tenant row isolation, key rotation handling, recovery from Cloudflare outages, tamper-evident audits, and full authenticated browser end-to-end tests remain outstanding.
