-- Circuit transitions and their event trail share the same SQLite transaction.
-- A logging failure aborts the circuit update instead of leaving unaudited state.
CREATE TRIGGER IF NOT EXISTS circuit_state_transition_audit
AFTER UPDATE OF state ON circuit_breakers
WHEN NEW.state<>OLD.state
BEGIN
 INSERT INTO circuit_events(id,model_id,from_state,to_state,reason,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.model_id,OLD.state,NEW.state,
 CASE WHEN NEW.state='open' THEN 'Circuit opened after consecutive provider failures'
      WHEN NEW.state='closed' THEN 'Circuit reset or recovered'
      ELSE 'Circuit entered half-open probe' END,NEW.updated_at);
END;
