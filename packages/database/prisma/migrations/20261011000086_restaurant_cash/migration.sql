-- Ресторан: оплата заказа, касса филиала, выплаты зарплаты (DATA_MODEL §35, v2.18, ADR-165)


-- CreateTable
CREATE TABLE "restaurant_payments" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
    "idempotency_key" VARCHAR(100) NOT NULL,
    "paid_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID,
    "voided_at" TIMESTAMPTZ(6),
    "voided_by_id" UUID,
    "void_reason" VARCHAR(200),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurant_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_cash_operations" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "kind" "CashOperationKind" NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "method_to" "PaymentMethod",
    "amount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "note" VARCHAR(500),
    "employee_id" UUID,
    "period" DATE,
    "status" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID,
    "voided_at" TIMESTAMPTZ(6),
    "voided_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurant_cash_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_cash_reconciliations" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "expected" BIGINT NOT NULL,
    "counted" BIGINT NOT NULL,
    "note" VARCHAR(500),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurant_cash_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "restaurant_payments_order_id_idx" ON "restaurant_payments"("order_id");

-- CreateIndex
CREATE INDEX "restaurant_payments_location_id_paid_at_idx" ON "restaurant_payments"("location_id", "paid_at");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_payments_location_id_idempotency_key_key" ON "restaurant_payments"("location_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "restaurant_cash_operations_location_id_occurred_at_idx" ON "restaurant_cash_operations"("location_id", "occurred_at");

-- CreateIndex
CREATE INDEX "restaurant_cash_operations_employee_id_period_idx" ON "restaurant_cash_operations"("employee_id", "period");

-- CreateIndex
CREATE INDEX "restaurant_cash_reconciliations_location_id_method_created__idx" ON "restaurant_cash_reconciliations"("location_id", "method", "created_at");

-- AddForeignKey
ALTER TABLE "restaurant_payments" ADD CONSTRAINT "restaurant_payments_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_payments" ADD CONSTRAINT "restaurant_payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "restaurant_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_payments" ADD CONSTRAINT "restaurant_payments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_payments" ADD CONSTRAINT "restaurant_payments_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_cash_operations" ADD CONSTRAINT "restaurant_cash_operations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_cash_operations" ADD CONSTRAINT "restaurant_cash_operations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_cash_operations" ADD CONSTRAINT "restaurant_cash_operations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_cash_operations" ADD CONSTRAINT "restaurant_cash_operations_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_cash_reconciliations" ADD CONSTRAINT "restaurant_cash_reconciliations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_cash_reconciliations" ADD CONSTRAINT "restaurant_cash_reconciliations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Инварианты значений (§35.1-35.3)
ALTER TABLE restaurant_payments ADD CONSTRAINT restaurant_payments_values CHECK (
  amount > 0 AND btrim(idempotency_key) <> ''
  AND ((status = 'VOIDED') = (voided_at IS NOT NULL))
  AND (status = 'COMPLETED' OR (void_reason IS NOT NULL AND btrim(void_reason) <> ''))
  AND (status = 'VOIDED' OR (voided_by_id IS NULL AND void_reason IS NULL))
);
ALTER TABLE restaurant_cash_operations ADD CONSTRAINT restaurant_cash_operations_values CHECK (
  amount > 0
  AND ((kind = 'TRANSFER') = (method_to IS NOT NULL))
  AND (method_to IS NULL OR method_to <> method)
  AND ((employee_id IS NULL) = (period IS NULL))
  AND (employee_id IS NULL OR kind = 'EXPENSE')
  AND (period IS NULL OR period = date_trunc('month', period)::date)
  AND ((status = 'VOIDED') = (voided_at IS NOT NULL))
  AND (status = 'VOIDED' OR voided_by_id IS NULL)
);
ALTER TABLE restaurant_cash_reconciliations ADD CONSTRAINT restaurant_cash_reconciliations_values CHECK (counted >= 0);

-- Принадлежность и неизменяемость: филиал FOOD_SERVICE, заказ своего филиала, сотрудник своего бизнеса;
-- меняется только аннулирование (created_by_id и voided_by_id не проверяются: их обнуляет удаление человека)
CREATE FUNCTION restaurant_cash_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE loc_biz uuid;
BEGIN
 IF TG_OP = 'UPDATE' AND NEW.location_id <> OLD.location_id THEN RAISE EXCEPTION 'Restaurant parent is immutable'; END IF;
 SELECT b.id INTO loc_biz FROM locations l JOIN businesses b ON b.id = l.business_id WHERE l.id = NEW.location_id AND b.vertical = 'FOOD_SERVICE';
 IF loc_biz IS NULL THEN RAISE EXCEPTION 'Restaurant location required'; END IF;
 CASE TG_TABLE_NAME
 WHEN 'restaurant_payments' THEN
  IF NOT EXISTS (SELECT 1 FROM restaurant_orders o WHERE o.id = NEW.order_id AND o.location_id = NEW.location_id) THEN RAISE EXCEPTION 'Payment order belongs to another location'; END IF;
  IF TG_OP = 'UPDATE' THEN
   IF (NEW.order_id, NEW.method, NEW.amount, NEW.currency, NEW.idempotency_key, NEW.paid_at, NEW.created_at)
      IS DISTINCT FROM (OLD.order_id, OLD.method, OLD.amount, OLD.currency, OLD.idempotency_key, OLD.paid_at, OLD.created_at)
   THEN RAISE EXCEPTION 'Restaurant payment is immutable'; END IF;
   IF OLD.status = 'VOIDED' AND NEW.status <> 'VOIDED' THEN RAISE EXCEPTION 'Voided payment stays voided'; END IF;
  END IF;
 WHEN 'restaurant_cash_operations' THEN
  IF NEW.employee_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM employees e WHERE e.id = NEW.employee_id AND e.business_id = loc_biz) THEN RAISE EXCEPTION 'Payout employee belongs to another business'; END IF;
  IF TG_OP = 'UPDATE' THEN
   IF (NEW.kind, NEW.method, NEW.method_to, NEW.amount, NEW.currency, NEW.note, NEW.employee_id, NEW.period, NEW.occurred_at, NEW.created_at)
      IS DISTINCT FROM (OLD.kind, OLD.method, OLD.method_to, OLD.amount, OLD.currency, OLD.note, OLD.employee_id, OLD.period, OLD.occurred_at, OLD.created_at)
   THEN RAISE EXCEPTION 'Restaurant cash operation is immutable'; END IF;
   IF OLD.status = 'VOIDED' AND NEW.status <> 'VOIDED' THEN RAISE EXCEPTION 'Voided operation stays voided'; END IF;
  END IF;
 ELSE NULL;
 END CASE;
 RETURN NEW;
END $$;

DO $$
DECLARE s text := current_schema(); path text; t text;
BEGIN
 path := CASE WHEN s='public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp',s) END;
 EXECUTE format('ALTER FUNCTION %I.restaurant_cash_guard() SET search_path = %s',s,path);
 FOREACH t IN ARRAY ARRAY['restaurant_payments','restaurant_cash_operations','restaurant_cash_reconciliations'] LOOP
  EXECUTE format('CREATE TRIGGER restaurant_cash_guard BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION restaurant_cash_guard()',t);
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 END LOOP;
END $$;

CREATE POLICY rls_tenant ON restaurant_payments TO wetop_app USING (EXISTS (SELECT 1 FROM locations l JOIN businesses b ON b.id=l.business_id WHERE l.id=location_id AND b.organization_id=app_current_org()));
CREATE POLICY rls_tenant ON restaurant_cash_operations TO wetop_app USING (EXISTS (SELECT 1 FROM locations l JOIN businesses b ON b.id=l.business_id WHERE l.id=location_id AND b.organization_id=app_current_org()));
CREATE POLICY rls_tenant ON restaurant_cash_reconciliations TO wetop_app USING (EXISTS (SELECT 1 FROM locations l JOIN businesses b ON b.id=l.business_id WHERE l.id=location_id AND b.organization_id=app_current_org()));
