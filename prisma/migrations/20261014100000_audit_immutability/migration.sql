-- Audit events are append-only. UPDATE is always rejected; DELETE is rejected unless the
-- transaction explicitly opts in via SET LOCAL app.audit_retention = 'on' (reserved for the
-- approved retention operation). TRUNCATE is not covered and is restricted by role privileges.
CREATE FUNCTION audit_events_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('app.audit_retention', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'audit_events is append-only (% rejected)', TG_OP USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_events_no_update_delete
BEFORE UPDATE OR DELETE ON "audit_events"
FOR EACH ROW EXECUTE FUNCTION audit_events_immutable();
