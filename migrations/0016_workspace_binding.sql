-- D1 deployment ownership fence. Existing database ownership cannot be silently overwritten.
-- Each product uses a distinct worker and a distinct D1 database on Workers Free.
CREATE TABLE IF NOT EXISTS app_workspace_binding (
  slot INTEGER PRIMARY KEY CHECK(slot=1),
  app_name TEXT NOT NULL,
  worker_name TEXT NOT NULL,
  database_name TEXT NOT NULL,
  policy TEXT NOT NULL CHECK(policy='single-workspace'),
  created_at TEXT NOT NULL
);
INSERT OR IGNORE INTO app_workspace_binding(slot,app_name,worker_name,database_name,policy,created_at)
  VALUES(1,'KestrelMesh','portfolio-kestrelmesh','portfolio-kestrelmesh-db','single-workspace','2026-10-15T00:00:00.000Z');
CREATE TRIGGER IF NOT EXISTS app_workspace_binding_block_update
  BEFORE UPDATE ON app_workspace_binding BEGIN SELECT RAISE(ABORT,'Workspace ownership is immutable'); END;
CREATE TRIGGER IF NOT EXISTS app_workspace_binding_block_delete
  BEFORE DELETE ON app_workspace_binding BEGIN SELECT RAISE(ABORT,'Workspace ownership is immutable'); END;
