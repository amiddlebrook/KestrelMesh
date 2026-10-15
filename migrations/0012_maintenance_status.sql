-- Automated quota-retention maintenance, UTC daily.
CREATE TABLE IF NOT EXISTS maintenance_status (
  job TEXT PRIMARY KEY,
  ran_at TEXT NOT NULL,
  rows_pruned INTEGER NOT NULL CHECK(rows_pruned>=0)
) WITHOUT ROWID;
