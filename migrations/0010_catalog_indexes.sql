CREATE INDEX IF NOT EXISTS idx_catalog_circuit_events_cursor ON circuit_events(created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_catalog_models_cursor ON models(created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_catalog_requests_cursor ON requests(created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_catalog_routing_rules_cursor ON routing_rules(created_at DESC,id DESC);
