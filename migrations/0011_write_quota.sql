-- Phase 20: per-credential, per-minute atomic D1 write quota counters.
-- Stores only opaque credential identifiers, never plaintext tokens or hashes.
CREATE TABLE IF NOT EXISTS api_write_quota (
 identity TEXT NOT NULL CHECK(length(identity)<=80),
 minute_bucket INTEGER NOT NULL,
 used INTEGER NOT NULL CHECK(used>=1),
 PRIMARY KEY(identity,minute_bucket)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_api_write_quota_bucket ON api_write_quota(minute_bucket);
