-- Per-credential views: only filter configuration, never business data or credentials.
CREATE TABLE IF NOT EXISTS saved_views (
 id TEXT PRIMARY KEY,
 owner TEXT NOT NULL,
 section TEXT NOT NULL,
 name TEXT NOT NULL,
 query TEXT NOT NULL DEFAULT '',
 preset TEXT NOT NULL DEFAULT 'all',
 sort_order TEXT NOT NULL DEFAULT 'newest',
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 UNIQUE(owner,section,name)
);
CREATE INDEX IF NOT EXISTS idx_saved_views_owner_section ON saved_views(owner,section,updated_at DESC);
