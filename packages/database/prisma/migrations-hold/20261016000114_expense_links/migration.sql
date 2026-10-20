-- 🔴 ОТДЕЛЬНЫЙ РЕЛИЗ (../README.md): only after exact release approval, verified restore and compatible writers.
-- HELD RELEASE. Existing cash linkage only. No new cash writer or historical currency inference.
ALTER TABLE cash_operations ADD COLUMN currency_snapshot char(3) CHECK (currency_snapshot ~ '^[A-Z]{3}$');
-- Snapshot is insert-only, including legacy NULL: no inferred backfill via ordinary UPDATE.
CREATE OR REPLACE FUNCTION hotel_cash_currency_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.currency_snapshot IS DISTINCT FROM OLD.currency_snapshot THEN RAISE EXCEPTION 'hotel cash currency immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER hotel_cash_currency_guard BEFORE UPDATE ON cash_operations FOR EACH ROW EXECUTE FUNCTION hotel_cash_currency_guard();
CREATE TABLE expense_categories (
 id uuid PRIMARY KEY, location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
 code text NOT NULL, name text NOT NULL, active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(location_id,code), UNIQUE(id,location_id)
);
CREATE TABLE expense_documents (
 id uuid PRIMARY KEY, location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
 category_id uuid NOT NULL, title text NOT NULL, document_date date NOT NULL, due_date date,
 amount_minor bigint NOT NULL CHECK(amount_minor>0), currency char(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 state text NOT NULL CHECK(state IN ('DRAFT','ACTIVE','CANCELLED')), version integer NOT NULL DEFAULT 1 CHECK(version>0),
 marketing_expense_id uuid UNIQUE REFERENCES marketing_expenses(id) ON DELETE RESTRICT,
 supplier_receipt_id uuid UNIQUE REFERENCES bar_receipts(id) ON DELETE RESTRICT,
 created_by_id uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(num_nonnulls(marketing_expense_id,supplier_receipt_id)<=1), UNIQUE(id,location_id),
 FOREIGN KEY(category_id,location_id) REFERENCES expense_categories(id,location_id) ON DELETE RESTRICT
);
CREATE INDEX expense_documents_period ON expense_documents(location_id,document_date,id);
CREATE TABLE expense_settlements (
 id uuid PRIMARY KEY, location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
 expense_document_id uuid NOT NULL, cash_operation_id uuid UNIQUE REFERENCES cash_operations(id) ON DELETE RESTRICT,
 restaurant_cash_operation_id uuid UNIQUE REFERENCES restaurant_cash_operations(id) ON DELETE RESTRICT,
 created_by_id uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(num_nonnulls(cash_operation_id,restaurant_cash_operation_id)=1),
 FOREIGN KEY(expense_document_id,location_id) REFERENCES expense_documents(id,location_id) ON DELETE RESTRICT
);
CREATE INDEX expense_settlements_document ON expense_settlements(expense_document_id);
CREATE TABLE payment_write_intents (
 id uuid PRIMARY KEY, location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
 intent_key text NOT NULL, action text NOT NULL, normalized_payload_hash text NOT NULL,
 result_id uuid NOT NULL, created_by_id uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(location_id,intent_key)
);
CREATE FUNCTION expense_paid_minor(doc uuid) RETURNS bigint LANGUAGE sql STABLE AS $$
 SELECT coalesce(sum(CASE WHEN c.status='COMPLETED' THEN c.amount ELSE 0 END),0)::bigint
 FROM expense_settlements s JOIN (
 SELECT id,amount,status,'H' AS source FROM cash_operations UNION ALL
 SELECT id,amount,status,'R' AS source FROM restaurant_cash_operations
 ) c ON (c.source='H' AND c.id=s.cash_operation_id) OR (c.source='R' AND c.id=s.restaurant_cash_operation_id)
 WHERE s.expense_document_id=doc
$$;
CREATE OR REPLACE FUNCTION expense_document_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r record;
BEGIN
 IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM expense_settlements WHERE expense_document_id=OLD.id) AND
 (NEW.location_id,NEW.amount_minor,NEW.currency,NEW.marketing_expense_id,NEW.supplier_receipt_id) IS DISTINCT FROM
 (OLD.location_id,OLD.amount_minor,OLD.currency,OLD.marketing_expense_id,OLD.supplier_receipt_id)
 THEN RAISE EXCEPTION 'expense history immutable'; END IF;
 IF NEW.state='CANCELLED' AND expense_paid_minor(NEW.id)>0 THEN RAISE EXCEPTION 'expense has active payments'; END IF;
 IF NEW.supplier_receipt_id IS NOT NULL THEN
 PERFORM 1 FROM locations WHERE id=NEW.location_id FOR NO KEY UPDATE;
 SELECT * INTO r FROM bar_receipts WHERE id=NEW.supplier_receipt_id FOR UPDATE;
 IF r.id IS NULL OR (r.location_id,r.total_amount,r.currency) IS DISTINCT FROM (NEW.location_id,NEW.amount_minor,NEW.currency)
 THEN RAISE EXCEPTION 'supplier receipt scope amount or currency mismatch'; END IF;
 END IF;
 IF NEW.marketing_expense_id IS NOT NULL THEN
 PERFORM 1 FROM locations WHERE id=NEW.location_id FOR NO KEY UPDATE;
 SELECT m.*,o.reporting_currency INTO r FROM marketing_expenses m
 JOIN locations l ON l.id=m.location_id JOIN businesses b ON b.id=l.business_id
 JOIN organizations o ON o.id=b.organization_id WHERE m.id=NEW.marketing_expense_id FOR UPDATE OF m;
 IF r.id IS NULL OR r.location_id IS DISTINCT FROM NEW.location_id THEN RAISE EXCEPTION 'marketing source mismatch'; END IF;
 IF r.currency IS DISTINCT FROM r.reporting_currency OR r.fx_rate<>1 OR r.amount<>r.base_amount THEN RAISE EXCEPTION 'marketing FX conflict'; END IF;
 IF TG_OP='UPDATE' AND OLD.marketing_expense_id=NEW.marketing_expense_id AND pg_trigger_depth()=1 THEN
  IF NEW.currency IS DISTINCT FROM r.currency THEN RAISE EXCEPTION 'marketing source mismatch'; END IF;
  UPDATE marketing_expenses SET amount=NEW.amount_minor,base_amount=NEW.amount_minor,updated_at=now()
   WHERE id=r.id AND amount IS DISTINCT FROM NEW.amount_minor;
  r.amount:=NEW.amount_minor;
 END IF;
 IF (r.amount,r.currency) IS DISTINCT FROM (NEW.amount_minor,NEW.currency) THEN RAISE EXCEPTION 'marketing source mismatch'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER expense_document_guard BEFORE INSERT OR UPDATE ON expense_documents FOR EACH ROW EXECUTE FUNCTION expense_document_guard();
CREATE FUNCTION expense_settlement_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d record; c record; supplier uuid;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'settlement history immutable'; END IF;
 -- NO KEY UPDATE serializes intents but remains compatible with relocation's location FK KEY SHARE.
 PERFORM 1 FROM locations WHERE id=NEW.location_id FOR NO KEY UPDATE;
 SELECT * INTO d FROM expense_documents WHERE id=NEW.expense_document_id FOR UPDATE;
 IF d.id IS NULL OR d.location_id<>NEW.location_id OR d.state<>'ACTIVE' THEN RAISE EXCEPTION 'expense not active in scope'; END IF;
 IF NEW.cash_operation_id IS NOT NULL THEN
 -- Freeze Property scope before taking cash locks; old cash inserts only take compatible FK KEY SHARE.
 PERFORM p.id FROM properties p JOIN cash_operations hc ON hc.property_id=p.id WHERE hc.id=NEW.cash_operation_id FOR SHARE OF p;
 SELECT hc.amount,hc.kind,hc.status,hc.currency_snapshot AS currency,p.location_id INTO c FROM cash_operations hc JOIN properties p ON p.id=hc.property_id WHERE hc.id=NEW.cash_operation_id FOR UPDATE OF hc;
 ELSE
 SELECT amount,kind,status,currency,location_id,(appointment_id IS NOT NULL OR order_id IS NOT NULL) AS customer_refund INTO c FROM restaurant_cash_operations WHERE id=NEW.restaurant_cash_operation_id FOR UPDATE;
 IF c.customer_refund THEN RAISE EXCEPTION 'customer refund is not an expense settlement'; END IF;
 END IF;
 IF c.amount IS NULL OR c.location_id IS DISTINCT FROM d.location_id OR c.currency IS DISTINCT FROM d.currency OR c.kind<>'EXPENSE' THEN RAISE EXCEPTION 'invalid canonical expense source'; END IF;
 SELECT receipt_id INTO supplier FROM bar_supplier_payments WHERE amount=c.amount AND
 ((NEW.cash_operation_id IS NOT NULL AND cash_operation_id=NEW.cash_operation_id) OR
 (NEW.restaurant_cash_operation_id IS NOT NULL AND restaurant_cash_operation_id=NEW.restaurant_cash_operation_id));
 IF c.status<>'COMPLETED' AND NOT(c.status='VOIDED' AND supplier IS NOT NULL AND supplier=d.supplier_receipt_id) THEN RAISE EXCEPTION 'invalid canonical expense source'; END IF;
 IF supplier IS DISTINCT FROM d.supplier_receipt_id THEN RAISE EXCEPTION 'supplier payment required for this receipt'; END IF;
 IF c.status='COMPLETED' AND expense_paid_minor(d.id)+c.amount>d.amount_minor THEN RAISE EXCEPTION 'expense overpayment'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER expense_settlement_guard BEFORE INSERT OR UPDATE OR DELETE ON expense_settlements FOR EACH ROW EXECUTE FUNCTION expense_settlement_guard();
-- Invoker rights preserve runtime tenant policies. Both paths serialize on location then receipt.
CREATE FUNCTION expense_supplier_sync() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d record; p record;
BEGIN
 IF TG_TABLE_NAME='expense_documents' THEN
  d:=NEW;
 ELSE
  SELECT * INTO d FROM expense_documents WHERE supplier_receipt_id=NEW.receipt_id;
 END IF;
 IF d.id IS NULL OR d.supplier_receipt_id IS NULL THEN RETURN NEW; END IF;
 FOR p IN SELECT * FROM bar_supplier_payments WHERE receipt_id=d.supplier_receipt_id ORDER BY id LOOP
  IF NOT EXISTS(SELECT 1 FROM expense_settlements WHERE cash_operation_id=p.cash_operation_id OR restaurant_cash_operation_id=p.restaurant_cash_operation_id) THEN
   INSERT INTO expense_settlements(id,location_id,expense_document_id,cash_operation_id,restaurant_cash_operation_id,created_by_id)
   VALUES(gen_random_uuid(),d.location_id,d.id,p.cash_operation_id,p.restaurant_cash_operation_id,p.created_by_id);
  ELSIF NOT EXISTS(SELECT 1 FROM expense_settlements WHERE expense_document_id=d.id AND (cash_operation_id=p.cash_operation_id OR restaurant_cash_operation_id=p.restaurant_cash_operation_id)) THEN
   RAISE EXCEPTION 'supplier source already linked elsewhere';
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER expense_supplier_backfill AFTER INSERT OR UPDATE OF supplier_receipt_id ON expense_documents FOR EACH ROW EXECUTE FUNCTION expense_supplier_sync();
CREATE TRIGGER expense_supplier_payment_sync AFTER INSERT ON bar_supplier_payments FOR EACH ROW EXECUTE FUNCTION expense_supplier_sync();
CREATE FUNCTION expense_supplier_payment_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM expense_documents WHERE supplier_receipt_id=OLD.receipt_id) THEN RAISE EXCEPTION 'linked supplier payment immutable'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER expense_supplier_payment_guard BEFORE UPDATE OR DELETE ON bar_supplier_payments FOR EACH ROW EXECUTE FUNCTION expense_supplier_payment_guard();
CREATE FUNCTION expense_cash_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM expense_settlements WHERE cash_operation_id=OLD.id OR restaurant_cash_operation_id=OLD.id) THEN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'linked cash immutable'; END IF;
 IF (to_jsonb(NEW)-ARRAY['status','voided_at','voided_by_id']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','voided_at','voided_by_id']) OR
 NOT (NEW.status=OLD.status OR (OLD.status='COMPLETED' AND NEW.status='VOIDED'))
 THEN RAISE EXCEPTION 'linked cash immutable except void'; END IF;
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER expense_cash_guard BEFORE UPDATE OR DELETE ON cash_operations FOR EACH ROW EXECUTE FUNCTION expense_cash_guard();
CREATE TRIGGER expense_cash_guard BEFORE UPDATE OR DELETE ON restaurant_cash_operations FOR EACH ROW EXECUTE FUNCTION expense_cash_guard();
CREATE FUNCTION expense_receipt_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM expense_documents WHERE supplier_receipt_id=OLD.id) AND
 (NEW.location_id,NEW.total_amount,NEW.currency) IS DISTINCT FROM (OLD.location_id,OLD.total_amount,OLD.currency)
 THEN RAISE EXCEPTION 'linked receipt immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER expense_receipt_guard BEFORE UPDATE ON bar_receipts FOR EACH ROW EXECUTE FUNCTION expense_receipt_guard();
-- No historical inference. Moving a property would otherwise move an already linked hotel operation.
CREATE FUNCTION expense_property_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.location_id IS DISTINCT FROM OLD.location_id AND EXISTS(SELECT 1 FROM expense_settlements s JOIN cash_operations c ON c.id=s.cash_operation_id WHERE c.property_id=OLD.id)
 THEN RAISE EXCEPTION 'linked property scope immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER expense_property_guard BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION expense_property_guard();
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['expense_categories','expense_documents','expense_settlements','payment_write_intents'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY rls_tenant ON %I TO wetop_app USING (EXISTS(SELECT 1 FROM locations l JOIN businesses b ON b.id=l.business_id WHERE l.id=location_id AND b.organization_id=app_current_org())) WITH CHECK (EXISTS(SELECT 1 FROM locations l JOIN businesses b ON b.id=l.business_id WHERE l.id=location_id AND b.organization_id=app_current_org()))',t);
 EXECUTE format('GRANT SELECT,INSERT,UPDATE ON %I TO wetop_app',t);
 END LOOP;
END $$;

-- MARKETING_LINK_SYNC: additive, invoker-rights hooks; no payment writer.
CREATE OR REPLACE FUNCTION expense_marketing_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d record;
BEGIN
 PERFORM 1 FROM locations WHERE id=OLD.location_id FOR NO KEY UPDATE;
 SELECT * INTO d FROM expense_documents WHERE marketing_expense_id=OLD.id FOR UPDATE;
 IF d.id IS NOT NULL THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'linked marketing deletion restricted'; END IF;
  IF NEW.location_id IS DISTINCT FROM OLD.location_id THEN RAISE EXCEPTION 'marketing source mismatch'; END IF;
  IF EXISTS(SELECT 1 FROM expense_settlements WHERE expense_document_id=d.id) AND
   (NEW.amount,NEW.currency,NEW.location_id,NEW.fx_rate,NEW.base_amount) IS DISTINCT FROM
   (OLD.amount,OLD.currency,OLD.location_id,OLD.fx_rate,OLD.base_amount)
  THEN RAISE EXCEPTION 'expense history immutable'; END IF;
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER expense_marketing_guard BEFORE UPDATE OR DELETE ON marketing_expenses FOR EACH ROW EXECUTE FUNCTION expense_marketing_guard();
CREATE OR REPLACE FUNCTION expense_marketing_sync() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 -- A document-origin update already owns the document; do not recursively update that tuple.
 IF pg_trigger_depth()=1 THEN
 UPDATE expense_documents SET amount_minor=NEW.amount,currency=NEW.currency,version=version+1,updated_at=now()
 WHERE marketing_expense_id=NEW.id AND (amount_minor,currency) IS DISTINCT FROM (NEW.amount,NEW.currency);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER expense_marketing_sync AFTER UPDATE ON marketing_expenses FOR EACH ROW EXECUTE FUNCTION expense_marketing_sync();
CREATE OR REPLACE FUNCTION expense_marketing_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.marketing_expense_id IS NOT NULL THEN
 INSERT INTO audit_logs(id,entity_type,entity_id,action,"before","after",organization_id,user_id)
 SELECT gen_random_uuid(),'ExpenseDocument',NEW.id::text,'MARKETING_DOCUMENT_SYNC',
 CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,to_jsonb(NEW),b.organization_id,NEW.created_by_id
 FROM locations l JOIN businesses b ON b.id=l.business_id WHERE l.id=NEW.location_id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER expense_marketing_audit AFTER INSERT OR UPDATE ON expense_documents FOR EACH ROW EXECUTE FUNCTION expense_marketing_audit();

-- Bind only this migration's owned routines to the actual application schema.
DO $owner_home_search_path$
DECLARE target_schema text := current_schema(); routine record;
BEGIN
  FOR routine IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname=target_schema AND p.proname=ANY(ARRAY['expense_cash_guard','expense_document_guard','expense_marketing_audit','expense_marketing_guard','expense_marketing_sync','expense_paid_minor','expense_property_guard','expense_receipt_guard','expense_settlement_guard','expense_supplier_payment_guard','expense_supplier_sync','hotel_cash_currency_guard'])
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path TO %I, public, pg_temp',routine.signature,target_schema);
  END LOOP;
END
$owner_home_search_path$;
