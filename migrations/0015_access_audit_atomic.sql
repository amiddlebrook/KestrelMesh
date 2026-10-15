-- Access credential mutations and their audit records are a single SQLite statement.
-- These triggers intentionally do not claim independent cryptographic audit integrity.
CREATE TRIGGER IF NOT EXISTS access_issue_audit
AFTER INSERT ON access_keys
BEGIN
  INSERT INTO access_audit(id,action,subject_id,actor_id,detail,created_at)
  VALUES(lower(hex(randomblob(16))),'issued',NEW.id,'root',
    json_object('role',NEW.role,'prefix',NEW.route_prefix,'expires_at',NEW.expires_at),NEW.created_at);
END;
CREATE TRIGGER IF NOT EXISTS access_revoke_audit
AFTER UPDATE OF revoked_at ON access_keys
WHEN OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL
BEGIN
  INSERT INTO access_audit(id,action,subject_id,actor_id,detail,created_at)
  VALUES(lower(hex(randomblob(16))),'revoked',NEW.id,'root',
    json_object('label',NEW.label),NEW.revoked_at);
END;
