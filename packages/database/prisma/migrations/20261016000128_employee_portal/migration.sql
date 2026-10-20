BEGIN;
-- Prepared additive employee portal release candidate. Production execution requires the owner-approved backup and schema/commit check.
CREATE TABLE employee_public_profiles (
 employee_id uuid PRIMARY KEY REFERENCES employees(id) ON DELETE RESTRICT,
 slug varchar(200) NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 headline varchar(200) NOT NULL DEFAULT '', biography varchar(5000) NOT NULL DEFAULT '',
 practice_since_year integer, published boolean NOT NULL DEFAULT false,
 publication_consent boolean NOT NULL DEFAULT false, revision integer NOT NULL DEFAULT 1,
 CONSTRAINT employee_public_consent CHECK (NOT published OR publication_consent),
 CONSTRAINT employee_public_revision CHECK (revision > 0),
 CONSTRAINT employee_public_year CHECK (practice_since_year IS NULL OR practice_since_year BETWEEN 1900 AND 2200)
);
CREATE TABLE employee_media (
 id uuid PRIMARY KEY, employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
 kind varchar(20) NOT NULL CHECK (kind IN ('AVATAR','PORTFOLIO')),
 storage_ref text NOT NULL UNIQUE, mime_type varchar(100) NOT NULL,
 width integer NOT NULL CHECK(width>0), height integer NOT NULL CHECK(height>0),
 byte_size integer NOT NULL CHECK(byte_size>0), sha256 char(64) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX employee_media_employee_id_kind_idx ON employee_media(employee_id,kind);
CREATE UNIQUE INDEX employee_media_one_avatar ON employee_media(employee_id) WHERE kind='AVATAR';
CREATE TABLE employee_portfolio_items (
 id uuid PRIMARY KEY, employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
 media_id uuid NOT NULL UNIQUE REFERENCES employee_media(id) ON DELETE RESTRICT,
 title varchar(200) NOT NULL, description varchar(2000) NOT NULL DEFAULT '',
 service_id uuid REFERENCES beauty_services(id) ON DELETE RESTRICT,
 published boolean NOT NULL DEFAULT false, publication_consent boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT employee_work_consent CHECK (NOT published OR publication_consent)
);
CREATE INDEX employee_portfolio_items_employee_id_idx ON employee_portfolio_items(employee_id);
CREATE TABLE beauty_payroll_policies (
 business_id uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE RESTRICT,
 percent_basis varchar(40) NOT NULL CHECK(percent_basis IN ('COMPLETED_SERVICES','PAID_COMPLETED_SERVICES')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0)
);
-- Existing duplicates must be reconciled by a manager before this index can be installed. Never silently remap.
CREATE UNIQUE INDEX employees_active_business_user_unique ON employees(business_id,user_id) WHERE user_id IS NOT NULL AND status='ACTIVE';

-- Fixed schema search_path: no caller-controlled object resolution in trigger / public resolver.
DO $migration$
DECLARE s text := current_schema(); t text;
BEGIN
 EXECUTE format($ddl$
 CREATE FUNCTION employee_portfolio_scope_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=%I,pg_temp AS $fn$
 BEGIN
  IF NOT EXISTS(SELECT 1 FROM employee_media m WHERE m.id=NEW.media_id AND m.employee_id=NEW.employee_id AND m.kind='PORTFOLIO') THEN
   RAISE EXCEPTION 'portfolio media ownership mismatch' USING ERRCODE='23514';
  END IF;
  IF NEW.service_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM beauty_services s JOIN employees e ON e.business_id=s.business_id WHERE s.id=NEW.service_id AND e.id=NEW.employee_id) THEN
   RAISE EXCEPTION 'portfolio service business mismatch' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
 END $fn$;
 $ddl$,s);
 EXECUTE 'CREATE TRIGGER employee_portfolio_scope BEFORE INSERT OR UPDATE ON employee_portfolio_items FOR EACH ROW EXECUTE FUNCTION employee_portfolio_scope_guard()';
 FOREACH t IN ARRAY ARRAY['employee_public_profiles','employee_media','employee_portfolio_items'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY rls_tenant ON %I TO wetop_app USING (EXISTS (SELECT 1 FROM employees e JOIN businesses b ON b.id=e.business_id WHERE e.id=employee_id AND b.organization_id = NULLIF(current_setting(''app.org_id'',true),'''')::uuid)) WITH CHECK (EXISTS (SELECT 1 FROM employees e JOIN businesses b ON b.id=e.business_id WHERE e.id=employee_id AND b.organization_id = NULLIF(current_setting(''app.org_id'',true),'''')::uuid))',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON %I TO wetop_app',t);
 END LOOP;
 EXECUTE 'ALTER TABLE beauty_payroll_policies ENABLE ROW LEVEL SECURITY';
 EXECUTE 'CREATE POLICY rls_tenant ON beauty_payroll_policies TO wetop_app USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id=business_id AND b.organization_id = NULLIF(current_setting(''app.org_id'',true),'''')::uuid)) WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id=business_id AND b.organization_id = NULLIF(current_setting(''app.org_id'',true),'''')::uuid))';
 EXECUTE 'GRANT SELECT,INSERT,UPDATE,DELETE ON beauty_payroll_policies TO wetop_app';
 -- Anonymous discovery is one slug, whitelisted identifiers only, no grants on private Employee.
 EXECUTE format($ddl$
 CREATE FUNCTION resolve_public_employee(requested_slug text) RETURNS TABLE(employee_id uuid,organization_id uuid)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=%I,pg_temp AS $fn$
 SELECT e.id,b.organization_id FROM employee_public_profiles p
 JOIN employees e ON e.id=p.employee_id JOIN businesses b ON b.id=e.business_id JOIN organizations o ON o.id=b.organization_id
 WHERE p.slug=requested_slug AND p.published AND p.publication_consent AND e.status='ACTIVE' AND b.status='ACTIVE'
 AND b.vertical IN ('BEAUTY','FOOD_SERVICE') AND o.status IN ('ACTIVE','TRIAL') LIMIT 1
 $fn$;
 $ddl$,s);
 EXECUTE 'REVOKE ALL ON FUNCTION resolve_public_employee(text) FROM PUBLIC';
 EXECUTE 'GRANT EXECUTE ON FUNCTION resolve_public_employee(text) TO wetop_app';
 EXECUTE 'REVOKE ALL ON FUNCTION employee_portfolio_scope_guard() FROM PUBLIC';
 -- Supabase roles may not exist on local/KZ PostgreSQL. Never create them to grant access.
 FOREACH t IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=t) THEN
   EXECUTE format('REVOKE ALL ON employee_public_profiles,employee_media,employee_portfolio_items,beauty_payroll_policies FROM %I',t);
   EXECUTE format('REVOKE ALL ON FUNCTION resolve_public_employee(text) FROM %I',t);
  END IF;
 END LOOP;
END $migration$;

REVOKE ALL ON employee_public_profiles, employee_media, employee_portfolio_items, beauty_payroll_policies FROM PUBLIC;
COMMIT;
