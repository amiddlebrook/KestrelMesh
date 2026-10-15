-- Free-only per-application atomic request and optional AI budgets.
-- Billing policies must still be enforced at the Cloudflare account level (Workers Free).
CREATE TABLE IF NOT EXISTS free_tier_budget (
 kind TEXT NOT NULL CHECK(kind IN ('api','ai')),
 day_bucket INTEGER NOT NULL,
 used INTEGER NOT NULL CHECK(used>=1),
 PRIMARY KEY(kind,day_bucket)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_free_tier_budget_day ON free_tier_budget(day_bucket);
