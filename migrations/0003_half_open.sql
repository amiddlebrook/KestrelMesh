CREATE TABLE IF NOT EXISTS circuit_leases(model_id TEXT PRIMARY KEY REFERENCES models(id),lease_id TEXT NOT NULL,expires_at TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_lease_expiry ON circuit_leases(expires_at);
