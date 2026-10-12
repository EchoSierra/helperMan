-- Least-privilege runtime role for the application.
-- Replace the two placeholders (e.g. with sed), then run once per environment as
-- the schema owner after `prisma migrate deploy`; re-run after migrations that add tables:
--   sed -e "s/__APP_ROLE__/helper_manager_app/" -e "s/__APP_PASSWORD__/<secret>/" scripts/sql/app-role.sql | psql "$OWNER_DATABASE_URL"
-- The application's DATABASE_URL must use this role; migrations keep using the owner.
-- audit_events is INSERT/SELECT only: no UPDATE, DELETE or TRUNCATE. Retention
-- deletes must run under a separate privileged job role.
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '__APP_ROLE__') THEN
    CREATE ROLE "__APP_ROLE__" LOGIN PASSWORD '__APP_PASSWORD__' NOSUPERUSER NOCREATEDB NOCREATEROLE;
  ELSE
    ALTER ROLE "__APP_ROLE__" PASSWORD '__APP_PASSWORD__';
  END IF;
  GRANT USAGE ON SCHEMA public TO "__APP_ROLE__";
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "__APP_ROLE__";
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "__APP_ROLE__";
  REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON audit_events FROM "__APP_ROLE__";
  REVOKE ALL ON _prisma_migrations FROM "__APP_ROLE__";
END
$do$;
