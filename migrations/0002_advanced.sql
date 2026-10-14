CREATE TABLE IF NOT EXISTS circuit_breakers(model_id TEXT PRIMARY KEY REFERENCES models(id),state TEXT NOT NULL CHECK(state IN('closed','open','half_open')),consecutive_failures INTEGER NOT NULL DEFAULT 0,opened_until TEXT,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS circuit_events(id TEXT PRIMARY KEY,model_id TEXT NOT NULL REFERENCES models(id),from_state TEXT NOT NULL,to_state TEXT NOT NULL,reason TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_circuit_state ON circuit_breakers(state,opened_until);
