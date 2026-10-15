-- Bounded diagnostic activity journal. No request bodies, query strings or credentials.
CREATE TABLE IF NOT EXISTS api_activity (id TEXT PRIMARY KEY,actor_kind TEXT NOT NULL,actor_id TEXT,actor_role TEXT NOT NULL,method TEXT NOT NULL,path TEXT NOT NULL,status INTEGER NOT NULL,duration_ms INTEGER NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_api_activity_time ON api_activity(created_at DESC,id DESC);
