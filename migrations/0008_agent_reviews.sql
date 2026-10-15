CREATE TABLE IF NOT EXISTS agent_reviews (id TEXT PRIMARY KEY,session_id TEXT NOT NULL UNIQUE REFERENCES agent_sessions(id),verdict TEXT NOT NULL CHECK(verdict IN ('accepted','rejected','requires_followup')),note TEXT NOT NULL,reviewed_by TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_agent_reviews_created ON agent_reviews(created_at DESC);
