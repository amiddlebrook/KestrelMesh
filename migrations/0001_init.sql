CREATE TABLE IF NOT EXISTS models(id TEXT PRIMARY KEY,name TEXT NOT NULL,provider TEXT NOT NULL,model_ref TEXT NOT NULL,priority INTEGER NOT NULL DEFAULT 10,enabled INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY,model_id TEXT NOT NULL,task TEXT NOT NULL,status TEXT NOT NULL,latency_ms INTEGER NOT NULL,input_chars INTEGER NOT NULL,output_chars INTEGER NOT NULL,cache_hit INTEGER NOT NULL,created_at TEXT NOT NULL,error TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS response_cache(key TEXT PRIMARY KEY,model_id TEXT NOT NULL,response TEXT NOT NULL,expires_at TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS routing_rules(id TEXT PRIMARY KEY,name TEXT NOT NULL,match_prefix TEXT NOT NULL,model_id TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_requests_created ON requests(created_at);
CREATE INDEX IF NOT EXISTS idx_cache_expiry ON response_cache(expires_at);
