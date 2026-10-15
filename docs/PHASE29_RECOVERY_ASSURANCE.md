# Phase 29 — Recoverability evidence and explicit limitations

This repository now runs `npm run verify:recovery` in both GitHub validation and before each Cloudflare deployment. The drill uses **only synthetic records**, the complete ordered D1/SQLite migrations, and Node.js 22's built-in SQLite online backup function. It restores the snapshot to an independent database and checks the entire schema fingerprint, table counts, foreign keys, SQLite integrity, and representative **KestrelMesh** domain records. A corrupted snapshot must fail SHA-256 verification. The job requires no paid service and retains no production records or database exports.

**This is not a Cloudflare D1 production-backup or restore claim.** D1 restore/export permissions, organization access, actual recovery point and time objectives, retention policy, and disaster-recovery drills against non-production Cloudflare infrastructure remain acceptance requirements. GitHub CI must never attach live production databases as public artifacts. The offline drill prevents schema and data-backup regressions but is not a substitute for operational recovery planning.

Release acceptance: GitHub `Validate` and `Deploy to Cloudflare Workers` jobs must pass the recovery drill. Existing live HTTP and Chromium browser assertions must continue to pass.

## Bounded live edge observation

After deployment, GitHub runs `npm run verify:edge` against the real Cloudflare health endpoint with exactly 24 read-only requests, at most 4 in flight, and a 10-second timeout. It reports sample p50/p95/p99 and fails the release on errors or p95 above 8 seconds. This uses fewer than 30 Worker requests per deployment and does not require a paid service. **It is an availability smoke/latency check, not realistic load testing or an uptime SLA.**
