-- Cross-application credential lifecycle; root token remains exclusively a Worker secret.
CREATE TABLE IF NOT EXISTS access_keys (
 id TEXT PRIMARY KEY, label TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('viewer','operator')),
 route_prefix TEXT NOT NULL, secret_hash TEXT NOT NULL UNIQUE,
 created_at TEXT NOT NULL, expires_at TEXT NOT NULL, revoked_at TEXT, last_used_at TEXT
);
CREATE INDEX IF NOT EXISTS access_keys_active ON access_keys(expires_at,revoked_at);
CREATE TABLE IF NOT EXISTS access_audit (
 id TEXT PRIMARY KEY, action TEXT NOT NULL CHECK(action IN ('issued','revoked')),
 subject_id TEXT NOT NULL, actor_id TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS access_audit_time ON access_audit(created_at DESC);
