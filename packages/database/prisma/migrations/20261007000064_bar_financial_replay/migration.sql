-- Approved D1-D4 and T11. Legacy rows are retained; ambiguous history fails closed.
DROP INDEX bar_sales_property_id_idempotency_key_key;
CREATE INDEX bar_sales_property_id_idempotency_key_idx ON bar_sales(property_id,idempotency_key);
CREATE TABLE bar_operation_intents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid NOT NULL,
 kind varchar(32) NOT NULL CHECK (kind IN ('SUPPLIER_PAYMENT','WRITE_OFF','RETAIL','FOLIO')),
 key varchar(120) NOT NULL CHECK (length(btrim(key)) > 0), request jsonb NOT NULL,
 result jsonb NOT NULL, operation_id uuid NOT NULL, created_by_id uuid,
 created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT bar_operation_intents_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX bar_operation_intents_property_id_kind_key_key ON bar_operation_intents(property_id,kind,key);
CREATE INDEX bar_operation_intents_property_id_created_at_idx ON bar_operation_intents(property_id,created_at);
CREATE TABLE bar_supplier_payment_reversals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid NOT NULL,
 payment_id uuid NOT NULL, amount_minor bigint NOT NULL CHECK (amount_minor > 0),
 created_by_id uuid, created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT bar_supplier_payment_reversals_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT bar_supplier_payment_reversals_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES bar_supplier_payments(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX bar_supplier_payment_reversals_payment_id_key ON bar_supplier_payment_reversals(payment_id);
CREATE INDEX bar_supplier_payment_reversals_property_id_created_at_idx ON bar_supplier_payment_reversals(property_id,created_at);
CREATE TABLE bar_cost_losses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid NOT NULL,
 sale_id uuid NOT NULL, amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
 reason text NOT NULL CHECK (length(btrim(reason)) > 0), created_by_id uuid,
 created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT bar_cost_losses_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT bar_cost_losses_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES bar_sales(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX bar_cost_losses_sale_id_key ON bar_cost_losses(sale_id);
CREATE INDEX bar_cost_losses_property_id_created_at_idx ON bar_cost_losses(property_id,created_at);
ALTER TABLE bar_sales ADD COLUMN reversal_restocked boolean;

DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN
  RAISE EXCEPTION 'BAR financial replay backfill requires administrative BYPASSRLS';
 END IF;
 IF EXISTS (SELECT 1 FROM bar_sales s WHERE
   (SELECT count(*) FROM bar_sale_lines l WHERE l.sale_id=s.id)<>1 OR
   s.total_cost IS DISTINCT FROM (SELECT sum(-m.units*m.unit_cost)::bigint FROM bar_stock_movements m WHERE m.source_type='BAR_SALE' AND m.source_id=s.id AND m.kind='SALE') OR
   EXISTS (SELECT 1 FROM bar_sale_lines l WHERE l.sale_id=s.id AND l.quantity_units IS DISTINCT FROM
     (SELECT sum(-m.units)::bigint FROM bar_stock_movements m WHERE m.source_type='BAR_SALE' AND m.source_id=s.id AND m.kind='SALE' AND m.product_id=l.product_id)) OR
   ((s.folio_id IS NULL) = (s.cash_operation_id IS NULL)) OR
   ((s.folio_id IS NULL) <> (s.charge_id IS NULL)) OR
   length(s.idempotency_key)>120 OR length(btrim(s.idempotency_key))=0
 ) THEN RAISE EXCEPTION 'Ambiguous legacy BAR sale: reconcile before migration'; END IF;
 IF EXISTS (SELECT 1 FROM bar_sales s WHERE s.status='REVERSED' AND
   EXISTS (SELECT 1 FROM bar_stock_movements m WHERE m.source_type='BAR_SALE_RETURN' AND m.source_id=s.id) AND
   EXISTS (SELECT 1 FROM bar_stock_movements m WHERE m.source_type='BAR_SALE' AND m.source_id=s.id AND m.kind='SALE' AND NOT EXISTS
     (SELECT 1 FROM bar_stock_movements r WHERE r.source_type='BAR_SALE_RETURN' AND r.source_id=s.id AND r.kind='SALE_RETURN' AND r.product_id=m.product_id AND r.lot_id=m.lot_id AND r.units=-m.units AND r.unit_cost=m.unit_cost))
 ) THEN RAISE EXCEPTION 'Partial legacy BAR restock: reconcile before migration'; END IF;
END $$;
UPDATE bar_sales s SET reversal_restocked=EXISTS
 (SELECT 1 FROM bar_stock_movements m WHERE m.source_type='BAR_SALE_RETURN' AND m.source_id=s.id AND m.kind='SALE_RETURN')
 WHERE s.status='REVERSED';
INSERT INTO bar_cost_losses(property_id,sale_id,amount_minor,reason,created_by_id,created_at)
 SELECT property_id,id,total_cost,'Legacy no-restock reversal, validated SALE evidence',created_by_id,coalesce(reversed_at,created_at)
 FROM bar_sales WHERE status='REVERSED' AND reversal_restocked=false;
INSERT INTO bar_supplier_payment_reversals(property_id,payment_id,amount_minor,created_by_id,created_at)
 SELECT r.property_id,p.id,p.amount,p.created_by_id,p.created_at
 FROM bar_supplier_payments p JOIN bar_receipts r ON r.id=p.receipt_id JOIN cash_operations c ON c.id=p.cash_operation_id WHERE c.status='VOIDED';
-- Only sales already have real client keys. No invented keys for legacy payments/write-offs.
INSERT INTO bar_operation_intents(property_id,kind,key,request,result,operation_id,created_by_id,created_at)
 SELECT s.property_id,CASE WHEN s.folio_id IS NULL THEN 'RETAIL' ELSE 'FOLIO' END,s.idempotency_key,
 CASE WHEN s.folio_id IS NULL THEN jsonb_build_object('productId',l.product_id,'quantityUnits',l.quantity_units::text,'method',c.method::text)
 ELSE jsonb_build_object('productId',l.product_id,'quantityUnits',l.quantity_units::text,'folioId',s.folio_id) END,
 jsonb_build_object('kind','posted','id',s.id,'status',s.status::text,'revenueMinor',s.total_revenue::text,'costMinor',s.total_cost::text) ||
 CASE WHEN s.folio_id IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('chargeId',s.charge_id) END,
 s.id,s.created_by_id,s.created_at
 FROM bar_sales s JOIN bar_sale_lines l ON l.sale_id=s.id LEFT JOIN cash_operations c ON c.id=s.cash_operation_id;

CREATE FUNCTION bar_financial_record_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE linked_property uuid; linked_amount bigint; linked_status text; matched boolean;
BEGIN
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'BAR financial records are immutable'; END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Unsupported BAR financial record operation'; END IF;
 IF TG_TABLE_NAME='bar_cost_losses' THEN
  SELECT property_id,total_cost,status::text='REVERSED' AND reversal_restocked=false INTO linked_property,linked_amount,matched FROM bar_sales WHERE id=NEW.sale_id FOR SHARE;
  IF linked_property IS DISTINCT FROM NEW.property_id OR linked_amount IS DISTINCT FROM NEW.amount_minor OR matched IS DISTINCT FROM true THEN RAISE EXCEPTION 'BAR cost loss ownership/state mismatch'; END IF;
 ELSIF TG_TABLE_NAME='bar_supplier_payment_reversals' THEN
  SELECT r.property_id,p.amount,c.status::text INTO linked_property,linked_amount,linked_status FROM bar_supplier_payments p JOIN bar_receipts r ON r.id=p.receipt_id JOIN cash_operations c ON c.id=p.cash_operation_id WHERE p.id=NEW.payment_id FOR SHARE OF p,r,c;
  IF linked_property IS DISTINCT FROM NEW.property_id OR linked_amount IS DISTINCT FROM NEW.amount_minor OR linked_status IS DISTINCT FROM 'VOIDED' THEN RAISE EXCEPTION 'BAR payment reversal ownership/state mismatch'; END IF;
 ELSIF TG_TABLE_NAME='bar_operation_intents' THEN
  IF NEW.result->>'id' IS DISTINCT FROM NEW.operation_id::text THEN RAISE EXCEPTION 'BAR replay result identity mismatch'; END IF;
  IF NEW.kind IN ('RETAIL','FOLIO') THEN
   SELECT s.property_id, s.folio_id IS NULL INTO linked_property,matched FROM bar_sales s WHERE s.id=NEW.operation_id FOR SHARE;
   IF linked_property IS DISTINCT FROM NEW.property_id OR matched IS DISTINCT FROM (NEW.kind='RETAIL') OR NOT EXISTS
    (SELECT 1 FROM bar_sale_lines l WHERE l.sale_id=NEW.operation_id AND l.product_id::text=NEW.request->>'productId' AND l.quantity_units::text=NEW.request->>'quantityUnits') THEN RAISE EXCEPTION 'BAR sale replay ownership mismatch'; END IF;
   IF NEW.kind='FOLIO' AND NOT EXISTS (SELECT 1 FROM bar_sales WHERE id=NEW.operation_id AND folio_id::text=NEW.request->>'folioId') THEN RAISE EXCEPTION 'BAR Folio replay mismatch'; END IF;
   IF NEW.kind='RETAIL' AND NOT EXISTS (SELECT 1 FROM bar_sales s JOIN cash_operations c ON c.id=s.cash_operation_id WHERE s.id=NEW.operation_id AND c.method::text=NEW.request->>'method') THEN RAISE EXCEPTION 'BAR retail replay method mismatch'; END IF;
  ELSIF NEW.kind='SUPPLIER_PAYMENT' THEN
   SELECT r.property_id,p.amount INTO linked_property,linked_amount FROM bar_supplier_payments p JOIN bar_receipts r ON r.id=p.receipt_id JOIN cash_operations c ON c.id=p.cash_operation_id WHERE p.id=NEW.operation_id AND r.id::text=NEW.request->>'receiptId' AND c.method::text=NEW.request->>'method' FOR SHARE OF p,r,c;
   IF linked_property IS DISTINCT FROM NEW.property_id OR linked_amount::text IS DISTINCT FROM NEW.request->>'amountMinor' THEN RAISE EXCEPTION 'BAR supplier replay ownership mismatch'; END IF;
  ELSIF NEW.kind='WRITE_OFF' THEN
   IF NOT EXISTS (SELECT 1 FROM bar_stock_movements WHERE source_type='BAR_WRITE_OFF' AND source_id=NEW.operation_id AND kind='WRITE_OFF') OR EXISTS
    (SELECT 1 FROM bar_stock_movements WHERE source_type='BAR_WRITE_OFF' AND source_id=NEW.operation_id AND (property_id<>NEW.property_id OR product_id::text IS DISTINCT FROM NEW.request->>'productId' OR note IS DISTINCT FROM NEW.request->>'reason')) OR
    (SELECT sum(-units)::text FROM bar_stock_movements WHERE source_type='BAR_WRITE_OFF' AND source_id=NEW.operation_id AND kind='WRITE_OFF') IS DISTINCT FROM NEW.request->>'quantityUnits' THEN RAISE EXCEPTION 'BAR write-off replay ownership mismatch'; END IF;
  ELSE RAISE EXCEPTION 'Unknown BAR replay kind'; END IF;
 ELSE RAISE EXCEPTION 'Unknown BAR financial record table'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION bar_financial_parent_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
 IF TG_TABLE_NAME='bar_sales' THEN
  IF EXISTS (SELECT 1 FROM bar_cost_losses WHERE sale_id=OLD.id) AND (NEW.total_cost IS DISTINCT FROM OLD.total_cost OR NEW.status IS DISTINCT FROM OLD.status OR NEW.reversal_restocked IS DISTINCT FROM OLD.reversal_restocked) THEN RAISE EXCEPTION 'BAR loss source is immutable'; END IF;
 ELSIF TG_TABLE_NAME='bar_supplier_payments' THEN
  IF EXISTS (SELECT 1 FROM bar_supplier_payment_reversals WHERE payment_id=OLD.id) AND (NEW.amount IS DISTINCT FROM OLD.amount OR NEW.receipt_id IS DISTINCT FROM OLD.receipt_id OR NEW.cash_operation_id IS DISTINCT FROM OLD.cash_operation_id) THEN RAISE EXCEPTION 'BAR reversed supplier payment is immutable'; END IF;
 ELSE RAISE EXCEPTION 'Unknown BAR financial parent table'; END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE s text:=current_schema(); path text; t text; BEGIN
 path:=CASE WHEN s='public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp',s) END;
 EXECUTE format('ALTER FUNCTION %I.bar_financial_record_guard() SET search_path = %s',s,path);
 EXECUTE format('ALTER FUNCTION %I.bar_financial_parent_guard() SET search_path = %s',s,path);
 FOREACH t IN ARRAY ARRAY['bar_operation_intents','bar_supplier_payment_reversals','bar_cost_losses'] LOOP
  EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION bar_financial_record_guard()',t||'_guard',t);
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY rls_tenant ON %I FOR ALL TO wetop_app USING (app_property_visible(property_id)) WITH CHECK (app_property_visible(property_id))',t);
  EXECUTE format('REVOKE DELETE ON %I FROM wetop_app,wetop_service',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON %I TO wetop_app,wetop_service',t);
 END LOOP;
END $$;
CREATE TRIGGER bar_sales_financial_parent_guard BEFORE UPDATE ON bar_sales FOR EACH ROW EXECUTE FUNCTION bar_financial_parent_guard();
CREATE TRIGGER bar_supplier_payments_financial_parent_guard BEFORE UPDATE ON bar_supplier_payments FOR EACH ROW EXECUTE FUNCTION bar_financial_parent_guard();
