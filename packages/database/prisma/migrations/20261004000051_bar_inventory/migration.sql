-- DATA_MODEL § 27, BAR1: товарный учет бара. Production: только после backup и отдельного разрешения.
CREATE TYPE "BarReceiptStatus" AS ENUM ('DRAFT', 'POSTED', 'REVERSED');
CREATE TYPE "BarStockMovementKind" AS ENUM ('RECEIPT', 'SALE', 'WRITE_OFF', 'SALE_RETURN', 'INVENTORY_ADJUSTMENT');

CREATE TABLE "bar_categories" (
  "id" uuid NOT NULL,
  "property_id" uuid NOT NULL,
  "name" text NOT NULL,
  "default_markup_basis" integer NOT NULL,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "bar_categories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bar_categories_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bar_categories_markup_nonnegative" CHECK ("default_markup_basis" >= 0)
);
CREATE UNIQUE INDEX "bar_categories_property_id_name_key" ON "bar_categories"("property_id", "name");

CREATE TABLE "bar_products" (
  "id" uuid NOT NULL,
  "property_id" uuid NOT NULL,
  "category_id" uuid,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "barcode" text,
  "units_per_package" integer NOT NULL DEFAULT 1,
  "markup_basis" integer,
  "sale_price" bigint NOT NULL,
  "minimum_stock_units" bigint NOT NULL DEFAULT 0,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(6) NOT NULL,
  CONSTRAINT "bar_products_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bar_products_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bar_products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "bar_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bar_products_values_valid" CHECK ("units_per_package" > 0 AND ("markup_basis" IS NULL OR "markup_basis" >= 0) AND "sale_price" > 0 AND "minimum_stock_units" >= 0)
);
CREATE UNIQUE INDEX "bar_products_property_id_code_key" ON "bar_products"("property_id", "code");
CREATE UNIQUE INDEX "bar_products_property_id_barcode_key" ON "bar_products"("property_id", "barcode");
CREATE INDEX "bar_products_property_id_active_idx" ON "bar_products"("property_id", "active");

CREATE TABLE "bar_suppliers" (
  "id" uuid NOT NULL,
  "property_id" uuid NOT NULL,
  "name" text NOT NULL,
  "phone" text,
  "email" text,
  "details" text,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(6) NOT NULL,
  CONSTRAINT "bar_suppliers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bar_suppliers_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "bar_suppliers_property_id_name_key" ON "bar_suppliers"("property_id", "name");

CREATE TABLE "bar_receipts" (
  "id" uuid NOT NULL,
  "property_id" uuid NOT NULL,
  "supplier_id" uuid NOT NULL,
  "document_number" text NOT NULL,
  "document_date" date NOT NULL,
  "received_date" date NOT NULL,
  "status" "BarReceiptStatus" NOT NULL DEFAULT 'DRAFT',
  "currency" char(3) NOT NULL,
  "total_amount" bigint NOT NULL,
  "note" text,
  "created_by_id" uuid,
  "posted_at" timestamptz(6),
  "reversed_at" timestamptz(6),
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(6) NOT NULL,
  CONSTRAINT "bar_receipts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bar_receipts_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bar_receipts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "bar_suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bar_receipts_total_positive" CHECK ("total_amount" > 0),
  CONSTRAINT "bar_receipts_status_times" CHECK (("status" = 'DRAFT' AND "posted_at" IS NULL AND "reversed_at" IS NULL) OR ("status" = 'POSTED' AND "posted_at" IS NOT NULL AND "reversed_at" IS NULL) OR ("status" = 'REVERSED' AND "posted_at" IS NOT NULL AND "reversed_at" IS NOT NULL))
);
CREATE UNIQUE INDEX "bar_receipts_property_id_supplier_id_document_number_key" ON "bar_receipts"("property_id", "supplier_id", "document_number");
CREATE INDEX "bar_receipts_property_id_received_date_idx" ON "bar_receipts"("property_id", "received_date");

CREATE TABLE "bar_receipt_lines" (
  "id" uuid NOT NULL,
  "receipt_id" uuid NOT NULL,
  "product_id" uuid NOT NULL,
  "quantity_units" bigint NOT NULL,
  "unit_cost" bigint NOT NULL,
  "amount" bigint NOT NULL,
  "markup_basis" integer NOT NULL,
  "calculated_price" bigint NOT NULL,
  CONSTRAINT "bar_receipt_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bar_receipt_lines_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "bar_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bar_receipt_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "bar_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bar_receipt_lines_values_valid" CHECK ("quantity_units" > 0 AND "unit_cost" > 0 AND "amount" = "quantity_units" * "unit_cost" AND "markup_basis" >= 0 AND "calculated_price" > 0)
);
CREATE UNIQUE INDEX "bar_receipt_lines_receipt_id_product_id_key" ON "bar_receipt_lines"("receipt_id", "product_id");

CREATE TABLE "bar_stock_lots" (
  "id" uuid NOT NULL,
  "property_id" uuid NOT NULL,
  "product_id" uuid NOT NULL,
  "receipt_line_id" uuid NOT NULL,
  "received_units" bigint NOT NULL,
  "remaining_units" bigint NOT NULL,
  "unit_cost" bigint NOT NULL,
  "received_at" timestamptz(6) NOT NULL,
  "expires_on" date,
  CONSTRAINT "bar_stock_lots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bar_stock_lots_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bar_stock_lots_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "bar_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bar_stock_lots_receipt_line_id_fkey" FOREIGN KEY ("receipt_line_id") REFERENCES "bar_receipt_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bar_stock_lots_units_valid" CHECK ("received_units" > 0 AND "remaining_units" >= 0 AND "remaining_units" <= "received_units" AND "unit_cost" > 0)
);
CREATE UNIQUE INDEX "bar_stock_lots_receipt_line_id_key" ON "bar_stock_lots"("receipt_line_id");
CREATE INDEX "bar_stock_lots_property_id_product_id_received_at_idx" ON "bar_stock_lots"("property_id", "product_id", "received_at");

CREATE TABLE "bar_stock_movements" (
  "id" uuid NOT NULL,
  "property_id" uuid NOT NULL,
  "product_id" uuid NOT NULL,
  "lot_id" uuid,
  "kind" "BarStockMovementKind" NOT NULL,
  "units" bigint NOT NULL,
  "unit_cost" bigint NOT NULL,
  "source_type" text NOT NULL,
  "source_id" uuid NOT NULL,
  "note" text,
  "created_by_id" uuid,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "bar_stock_movements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bar_stock_movements_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bar_stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "bar_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bar_stock_movements_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "bar_stock_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bar_stock_movements_values_valid" CHECK ("units" <> 0 AND "unit_cost" > 0 AND btrim("source_type") <> '')
);
CREATE UNIQUE INDEX "bar_stock_movements_source_type_source_id_product_id_lot_id_key" ON "bar_stock_movements"("source_type", "source_id", "product_id", "lot_id");
CREATE INDEX "bar_stock_movements_property_id_product_id_created_at_idx" ON "bar_stock_movements"("property_id", "product_id", "created_at");

CREATE TABLE "bar_supplier_payments" (
  "id" uuid NOT NULL,
  "receipt_id" uuid NOT NULL,
  "cash_operation_id" uuid NOT NULL,
  "amount" bigint NOT NULL,
  "paid_at" timestamptz(6) NOT NULL,
  "created_by_id" uuid,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "bar_supplier_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bar_supplier_payments_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "bar_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bar_supplier_payments_cash_operation_id_fkey" FOREIGN KEY ("cash_operation_id") REFERENCES "cash_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bar_supplier_payments_amount_positive" CHECK ("amount" > 0)
);
CREATE UNIQUE INDEX "bar_supplier_payments_cash_operation_id_key" ON "bar_supplier_payments"("cash_operation_id");
CREATE INDEX "bar_supplier_payments_receipt_id_paid_at_idx" ON "bar_supplier_payments"("receipt_id", "paid_at");

CREATE TYPE "BarSaleStatus" AS ENUM ('POSTED', 'REVERSED');
CREATE TABLE "bar_sales" (
  "id" uuid NOT NULL, "property_id" uuid NOT NULL, "folio_id" uuid, "cash_operation_id" uuid, "charge_id" uuid,
  "idempotency_key" text NOT NULL, "status" "BarSaleStatus" NOT NULL DEFAULT 'POSTED', "currency" char(3) NOT NULL,
  "total_revenue" bigint NOT NULL, "total_cost" bigint NOT NULL, "created_by_id" uuid,
  "reversed_at" timestamptz(6), "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "bar_sales_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bar_sales_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bar_sales_folio_id_fkey" FOREIGN KEY ("folio_id") REFERENCES "folios"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bar_sales_cash_operation_id_fkey" FOREIGN KEY ("cash_operation_id") REFERENCES "cash_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bar_sales_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "charges"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bar_sales_values_valid" CHECK ("total_revenue" > 0 AND "total_cost" > 0 AND (("status" = 'POSTED' AND "reversed_at" IS NULL) OR ("status" = 'REVERSED' AND "reversed_at" IS NOT NULL)))
);
CREATE UNIQUE INDEX "bar_sales_cash_operation_id_key" ON "bar_sales"("cash_operation_id");
CREATE UNIQUE INDEX "bar_sales_charge_id_key" ON "bar_sales"("charge_id");
CREATE UNIQUE INDEX "bar_sales_property_id_idempotency_key_key" ON "bar_sales"("property_id", "idempotency_key");
CREATE INDEX "bar_sales_property_id_created_at_idx" ON "bar_sales"("property_id", "created_at");

CREATE TABLE "bar_sale_lines" (
  "id" uuid NOT NULL, "sale_id" uuid NOT NULL, "product_id" uuid NOT NULL, "quantity_units" bigint NOT NULL,
  "sale_price" bigint NOT NULL, "revenue" bigint NOT NULL, "cost" bigint NOT NULL,
  CONSTRAINT "bar_sale_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bar_sale_lines_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "bar_sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bar_sale_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "bar_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bar_sale_lines_values_valid" CHECK ("quantity_units" > 0 AND "sale_price" > 0 AND "revenue" = "quantity_units" * "sale_price" AND "cost" > 0)
);
CREATE UNIQUE INDEX "bar_sale_lines_sale_id_product_id_key" ON "bar_sale_lines"("sale_id", "product_id");

-- Категория, товар, поставщик и приход всегда принадлежат одному объекту.
CREATE OR REPLACE FUNCTION bar_property_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'bar_products' AND NEW.category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM bar_categories c WHERE c.id = NEW.category_id AND c.property_id = NEW.property_id) THEN RAISE EXCEPTION 'Category belongs to another property'; END IF;
  IF TG_TABLE_NAME = 'bar_receipts' AND NOT EXISTS (SELECT 1 FROM bar_suppliers s WHERE s.id = NEW.supplier_id AND s.property_id = NEW.property_id) THEN RAISE EXCEPTION 'Supplier belongs to another property'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "bar_products_property_guard" BEFORE INSERT OR UPDATE OF "category_id", "property_id" ON "bar_products" FOR EACH ROW EXECUTE FUNCTION bar_property_guard();
CREATE TRIGGER "bar_receipts_property_guard" BEFORE INSERT OR UPDATE OF "supplier_id", "property_id" ON "bar_receipts" FOR EACH ROW EXECUTE FUNCTION bar_property_guard();

ALTER TABLE "bar_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bar_products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bar_suppliers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bar_receipts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bar_receipt_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bar_stock_lots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bar_stock_movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bar_supplier_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bar_sales" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bar_sale_lines" ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "bar_categories" FOR ALL TO wetop_app USING (app_property_visible("property_id")) WITH CHECK (app_property_visible("property_id"));
CREATE POLICY rls_tenant ON "bar_products" FOR ALL TO wetop_app USING (app_property_visible("property_id")) WITH CHECK (app_property_visible("property_id"));
CREATE POLICY rls_tenant ON "bar_suppliers" FOR ALL TO wetop_app USING (app_property_visible("property_id")) WITH CHECK (app_property_visible("property_id"));
CREATE POLICY rls_tenant ON "bar_receipts" FOR ALL TO wetop_app USING (app_property_visible("property_id")) WITH CHECK (app_property_visible("property_id"));
CREATE POLICY rls_tenant ON "bar_receipt_lines" FOR ALL TO wetop_app USING (EXISTS (SELECT 1 FROM bar_receipts r WHERE r.id = receipt_id AND app_property_visible(r.property_id))) WITH CHECK (EXISTS (SELECT 1 FROM bar_receipts r WHERE r.id = receipt_id AND app_property_visible(r.property_id)));
CREATE POLICY rls_tenant ON "bar_stock_lots" FOR ALL TO wetop_app USING (app_property_visible("property_id")) WITH CHECK (app_property_visible("property_id"));
CREATE POLICY rls_tenant ON "bar_stock_movements" FOR ALL TO wetop_app USING (app_property_visible("property_id")) WITH CHECK (app_property_visible("property_id"));
CREATE POLICY rls_tenant ON "bar_supplier_payments" FOR ALL TO wetop_app USING (EXISTS (SELECT 1 FROM bar_receipts r WHERE r.id = receipt_id AND app_property_visible(r.property_id))) WITH CHECK (EXISTS (SELECT 1 FROM bar_receipts r WHERE r.id = receipt_id AND app_property_visible(r.property_id)));
CREATE POLICY rls_tenant ON "bar_sales" FOR ALL TO wetop_app USING (app_property_visible("property_id")) WITH CHECK (app_property_visible("property_id"));
CREATE POLICY rls_tenant ON "bar_sale_lines" FOR ALL TO wetop_app USING (EXISTS (SELECT 1 FROM bar_sales s WHERE s.id = sale_id AND app_property_visible(s.property_id))) WITH CHECK (EXISTS (SELECT 1 FROM bar_sales s WHERE s.id = sale_id AND app_property_visible(s.property_id)));
