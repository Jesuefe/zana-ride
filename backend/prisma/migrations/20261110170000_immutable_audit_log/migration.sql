-- Audit records are append-only. Corrections must be recorded as new events,
-- never by rewriting or deleting the original action history.
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'AUDIT_LOG_IS_IMMUTABLE: append a correcting audit event instead';
END;
$$;

CREATE TRIGGER audit_log_immutable
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_mutation();