-- SL4-M4B2: approved additive journal, no rewrite of customers or history.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TABLE customer_imports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
 created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 client_request_id uuid NOT NULL,
 request_digest varchar(64) NOT NULL,
 state varchar(16) NOT NULL DEFAULT 'UPLOADING',
 total_rows integer NOT NULL,
 uploaded_rows integer NOT NULL DEFAULT 0,
 processed_rows integer NOT NULL DEFAULT 0,
 created_count integer NOT NULL DEFAULT 0,
 linked_count integer NOT NULL DEFAULT 0,
 unchanged_count integer NOT NULL DEFAULT 0,
 skipped_count integer NOT NULL DEFAULT 0,
 upload_receipts jsonb NOT NULL DEFAULT '{}',
 lease_token uuid, lease_expires_at timestamptz,
 attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(),
 error_code varchar(64), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz, undo_deadline timestamptz, contents_expire_at timestamptz NOT NULL,
 CONSTRAINT customer_imports_organization_id_client_request_id_key UNIQUE (organization_id,client_request_id),
 CONSTRAINT customer_imports_id_organization_id_key UNIQUE(id,organization_id),
 CONSTRAINT customer_imports_state_check CHECK(state IN ('UPLOADING','QUEUED','PROCESSING','COMPLETED','FAILED','UNDOING','UNDONE')),
 CONSTRAINT customer_imports_bounds_check CHECK(total_rows BETWEEN 1 AND 50000 AND uploaded_rows BETWEEN 0 AND total_rows AND processed_rows BETWEEN 0 AND uploaded_rows AND attempts>=0),
 CONSTRAINT customer_imports_counts_check CHECK(created_count>=0 AND linked_count>=0 AND unchanged_count>=0 AND skipped_count>=0 AND created_count+linked_count+unchanged_count+skipped_count=processed_rows),
 CONSTRAINT customer_imports_retention_check CHECK(undo_deadline IS NULL OR contents_expire_at>=undo_deadline),
 CONSTRAINT customer_imports_receipts_check CHECK(jsonb_typeof(upload_receipts)='object')
);
CREATE INDEX customer_imports_state_next_attempt_at_lease_expires_at_idx ON customer_imports(state,next_attempt_at,lease_expires_at);
CREATE INDEX customer_imports_organization_id_business_id_created_at_idx ON customer_imports(organization_id,business_id,created_at);
CREATE TABLE customer_import_rows (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL,
 import_id uuid NOT NULL,
 ordinal integer NOT NULL CHECK(ordinal>=0 AND ordinal<50000),
 source_line integer NOT NULL CHECK(source_line>=2),
 input jsonb,
 outcome varchar(16) NOT NULL DEFAULT 'PENDING' CHECK(outcome IN ('PENDING','CREATED','LINKED','UNCHANGED','SKIPPED')),
 error_code varchar(64), customer_id uuid, customer_baseline jsonb, link_baseline timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT customer_import_rows_import_id_ordinal_key UNIQUE(import_id,ordinal),
 CONSTRAINT customer_import_rows_tenant_fkey FOREIGN KEY(import_id,organization_id) REFERENCES customer_imports(id,organization_id) ON DELETE RESTRICT,
 CONSTRAINT customer_import_rows_input_check CHECK(input IS NULL OR (jsonb_typeof(input)='object' AND octet_length(input::text)<=4096)),
 CONSTRAINT customer_import_rows_baseline_check CHECK(customer_baseline IS NULL OR (jsonb_typeof(customer_baseline)='object' AND octet_length(customer_baseline::text)<=4096))
);
CREATE INDEX customer_import_rows_organization_id_idx ON customer_import_rows(organization_id);
CREATE INDEX customer_import_rows_customer_id_idx ON customer_import_rows(customer_id);

DO $migration$
DECLARE s text := current_schema(); t text; r text;
BEGIN
 EXECUTE format($ddl$
 CREATE FUNCTION customer_import_scope_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=%I,pg_catalog AS $fn$
 BEGIN
  IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.business_id IS DISTINCT FROM OLD.business_id OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.client_request_id IS DISTINCT FROM OLD.client_request_id OR NEW.total_rows IS DISTINCT FROM OLD.total_rows OR NEW.request_digest IS DISTINCT FROM OLD.request_digest) THEN
   RAISE EXCEPTION 'immutable import identity' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM businesses b WHERE b.id=NEW.business_id AND b.organization_id=NEW.organization_id AND b.vertical='BEAUTY') THEN
   RAISE EXCEPTION 'import business scope mismatch' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
 END $fn$;
 $ddl$,s);
 CREATE TRIGGER customer_import_scope BEFORE INSERT OR UPDATE ON customer_imports FOR EACH ROW EXECUTE FUNCTION customer_import_scope_guard();
 EXECUTE format($ddl$
 CREATE FUNCTION customer_import_row_identity_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=%I,pg_catalog AS $fn$
 BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.import_id IS DISTINCT FROM OLD.import_id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.ordinal IS DISTINCT FROM OLD.ordinal OR NEW.source_line IS DISTINCT FROM OLD.source_line THEN
   RAISE EXCEPTION 'immutable import source identity' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
 END $fn$;
 $ddl$,s);
 CREATE TRIGGER customer_import_row_identity BEFORE UPDATE ON customer_import_rows FOR EACH ROW EXECUTE FUNCTION customer_import_row_identity_guard();

 FOREACH t IN ARRAY ARRAY['customer_imports','customer_import_rows'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY rls_tenant ON %I TO wetop_app USING (organization_id=NULLIF(current_setting(''app.org_id'',true),'''')::uuid) WITH CHECK (organization_id=NULLIF(current_setting(''app.org_id'',true),'''')::uuid)',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC',t);
  EXECUTE format('REVOKE ALL ON %I FROM wetop_app',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON %I TO wetop_app',t);
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON %I FROM %I',t,r); END IF;
  END LOOP;
 END LOOP;
 REVOKE ALL ON FUNCTION customer_import_scope_guard() FROM PUBLIC;
 REVOKE ALL ON FUNCTION customer_import_row_identity_guard() FROM PUBLIC;
 GRANT EXECUTE ON FUNCTION customer_import_row_identity_guard() TO wetop_app;
 GRANT EXECUTE ON FUNCTION customer_import_scope_guard() TO wetop_app;
END $migration$;
COMMIT;
