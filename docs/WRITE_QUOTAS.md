# Mutation safety — Phase 20

**Design:** API authentication occurs before rate limiting. Atomic D1 upserts for `(principal_id, minute_bucket)` reserve one mutation attempt; success means `meta.changes===1`. Failed reservations return **429** with `Retry-After` through the standard Worker response boundary. Root limit: **180**/minute; operator key: **60**/minute. No raw bearer secrets or secret hashes are written to quota counters. Read-only credentials are denied by authentication. Any data-storage error fails closed (5xx).

**What it prevents:** Concurrent write floods, unbounded automated retries per issued credential, mistaken duplicate mutation storms. Failed validation or nonexistent write endpoints also cost quota to limit abuse.

**What it doesn't:** DDoS mitigation for unauthenticated traffic, global per-IP limits, account-level sharing/tenant boundaries, a durable audit log, idempotency of non-idempotent endpoints, distributed exact-time-window behavior, or automatic retention management. The window is a fixed 60-second bucket; a boundary allows two full windows in short succession.

**Operations:** Root-only `GET /api/access/write-quota` returns current bucket aggregate counts. Root-only `POST /api/access/write-quota/prune` deletes rows older than 24 hours; schedule this maintenance periodically with existing administration tools. Do not expose it to operator or viewer keys. The Access Intelligence workspace displays current usage.

**Test plan:** Full Worker.fetch tests replay all SQL migrations and check authentication, cross-key isolation, contention, 429 Retry-After, root vs operator ceilings, no-secret responses, read availability, and retention pruning.
