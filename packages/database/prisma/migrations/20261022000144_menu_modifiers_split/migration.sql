-- 144 Модификаторы блюд и деление счёта по позициям (решение владельца 22.10.2026,
-- docs/decisions/2026-10-22-menu-modifiers-split.md, DATA_MODEL §33.7).
-- 1) Группы модификаторов бизнеса (Размер, Добавки), модификаторы с прибавкой к цене, связь группы с блюдом.
-- 2) Снимок выбранных модификаторов у строки заказа (цена строки уже заморожена в restaurant_order_items.price).
-- 3) Оплата по позициям: платёж держит строки заказа; строка в одном действующем платеже; аннулирование освобождает.
-- Аддитивно: старый API новые таблицы не читает. Права таблиц как у соседних restaurant_* (миграции 82, 87).
BEGIN;

CREATE TABLE "menu_modifier_groups" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "business_id" UUID NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "min_select" INTEGER NOT NULL DEFAULT 0,
  "max_select" INTEGER NOT NULL DEFAULT 1,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "menu_modifier_groups_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "menu_modifier_groups_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "menu_modifier_groups_values" CHECK (
    btrim("name") <> '' AND "min_select" >= 0 AND "max_select" >= 1 AND "max_select" <= 20 AND "min_select" <= "max_select"
  )
);
CREATE UNIQUE INDEX "menu_modifier_groups_business_id_name_key" ON "menu_modifier_groups"("business_id", "name");

CREATE TABLE "menu_modifiers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "group_id" UUID NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "price_delta" BIGINT NOT NULL DEFAULT 0,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "menu_modifiers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "menu_modifiers_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "menu_modifier_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "menu_modifiers_values" CHECK (btrim("name") <> '' AND abs("price_delta") <= 100000000000)
);
CREATE INDEX "menu_modifiers_group_id_idx" ON "menu_modifiers"("group_id");

CREATE TABLE "menu_item_modifier_groups" (
  "menu_item_id" UUID NOT NULL,
  "group_id" UUID NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "menu_item_modifier_groups_pkey" PRIMARY KEY ("menu_item_id", "group_id"),
  CONSTRAINT "menu_item_modifier_groups_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "menu_item_modifier_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "menu_modifier_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "menu_item_modifier_groups_group_id_idx" ON "menu_item_modifier_groups"("group_id");

CREATE TABLE "restaurant_order_item_modifiers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "order_item_id" UUID NOT NULL,
  "modifier_id" UUID,
  "group_name" VARCHAR(100) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "price_delta" BIGINT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "restaurant_order_item_modifiers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "restaurant_order_item_modifiers_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "restaurant_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "restaurant_order_item_modifiers_modifier_id_fkey" FOREIGN KEY ("modifier_id") REFERENCES "menu_modifiers"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "restaurant_order_item_modifiers_values" CHECK (btrim("name") <> '' AND btrim("group_name") <> '')
);
CREATE INDEX "restaurant_order_item_modifiers_order_item_id_idx" ON "restaurant_order_item_modifiers"("order_item_id");
CREATE INDEX "restaurant_order_item_modifiers_modifier_id_idx" ON "restaurant_order_item_modifiers"("modifier_id");

CREATE TABLE "restaurant_payment_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "payment_id" UUID NOT NULL,
  "order_item_id" UUID NOT NULL,
  "amount" BIGINT NOT NULL,
  "released_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "restaurant_payment_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "restaurant_payment_items_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "restaurant_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "restaurant_payment_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "restaurant_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "restaurant_payment_items_values" CHECK ("amount" >= 0)
);
CREATE UNIQUE INDEX "restaurant_payment_items_payment_id_order_item_id_key" ON "restaurant_payment_items"("payment_id", "order_item_id");
CREATE INDEX "restaurant_payment_items_order_item_id_idx" ON "restaurant_payment_items"("order_item_id");
-- строка заказа оплачивается одним действующим платежом: вторая оплата той же строки отклоняется базой
CREATE UNIQUE INDEX "restaurant_payment_items_active_item_key" ON "restaurant_payment_items"("order_item_id") WHERE "released_at" IS NULL;

-- Принадлежность: группа бизнеса FOOD_SERVICE, модификатор не меняет группу, блюдо и группа одного бизнеса,
-- снимок модификатора того же бизнеса, строка платежа из заказа этого платежа.
CREATE FUNCTION restaurant_modifier_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 CASE TG_TABLE_NAME
 WHEN 'menu_modifier_groups' THEN
  IF TG_OP = 'UPDATE' AND NEW.business_id <> OLD.business_id THEN RAISE EXCEPTION 'Restaurant parent is immutable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM businesses WHERE id = NEW.business_id AND vertical = 'FOOD_SERVICE') THEN RAISE EXCEPTION 'Restaurant business required'; END IF;
 WHEN 'menu_modifiers' THEN
  IF TG_OP = 'UPDATE' AND NEW.group_id <> OLD.group_id THEN RAISE EXCEPTION 'Restaurant parent is immutable'; END IF;
 WHEN 'menu_item_modifier_groups' THEN
  IF NOT EXISTS (SELECT 1 FROM menu_items m JOIN menu_modifier_groups g ON g.business_id = m.business_id
                  WHERE m.id = NEW.menu_item_id AND g.id = NEW.group_id) THEN
   RAISE EXCEPTION 'Modifier group belongs to another business';
  END IF;
 WHEN 'restaurant_order_item_modifiers' THEN
  IF TG_OP = 'UPDATE' AND NEW.order_item_id <> OLD.order_item_id THEN RAISE EXCEPTION 'Restaurant parent is immutable'; END IF;
  IF NEW.modifier_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM restaurant_order_items i JOIN restaurant_orders o ON o.id = i.order_id JOIN locations l ON l.id = o.location_id
      JOIN menu_modifiers mm ON mm.id = NEW.modifier_id JOIN menu_modifier_groups g ON g.id = mm.group_id
     WHERE i.id = NEW.order_item_id AND g.business_id = l.business_id) THEN
   RAISE EXCEPTION 'Order modifier belongs to another business';
  END IF;
 WHEN 'restaurant_payment_items' THEN
  IF TG_OP = 'UPDATE' THEN
   IF (NEW.payment_id, NEW.order_item_id, NEW.amount, NEW.created_at) IS DISTINCT FROM (OLD.payment_id, OLD.order_item_id, OLD.amount, OLD.created_at)
   THEN RAISE EXCEPTION 'Restaurant payment item is immutable'; END IF;
   IF OLD.released_at IS NOT NULL AND NEW.released_at IS DISTINCT FROM OLD.released_at THEN RAISE EXCEPTION 'Released payment item stays released'; END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM restaurant_payments p JOIN restaurant_order_items i ON i.order_id = p.order_id
                  WHERE p.id = NEW.payment_id AND i.id = NEW.order_item_id) THEN
   RAISE EXCEPTION 'Payment item belongs to another order';
  END IF;
  IF TG_OP = 'INSERT' AND EXISTS (SELECT 1 FROM restaurant_payments p WHERE p.id = NEW.payment_id AND p.status <> 'COMPLETED') THEN
   RAISE EXCEPTION 'Payment item requires a completed payment';
  END IF;
 END CASE;
 RETURN NEW;
END $$;

-- Аннулированный платёж освобождает свои строки: их снова можно оплатить
CREATE FUNCTION restaurant_payment_items_release() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status <> 'COMPLETED' AND OLD.status = 'COMPLETED' THEN
  UPDATE restaurant_payment_items SET released_at = CURRENT_TIMESTAMP WHERE payment_id = NEW.id AND released_at IS NULL;
 END IF;
 RETURN NEW;
END $$;

-- Оплаченную строку нельзя удалить из заказа (замена состава)
CREATE FUNCTION restaurant_order_item_paid_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM restaurant_payment_items WHERE order_item_id = OLD.id AND released_at IS NULL) THEN
  RAISE EXCEPTION 'Paid order item cannot be removed';
 END IF;
 RETURN OLD;
END $$;

DO $$
DECLARE s text := current_schema(); path text; t text;
BEGIN
 path := CASE WHEN s='public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp',s) END;
 EXECUTE format('ALTER FUNCTION %I.restaurant_modifier_guard() SET search_path = %s',s,path);
 EXECUTE format('ALTER FUNCTION %I.restaurant_payment_items_release() SET search_path = %s',s,path);
 EXECUTE format('ALTER FUNCTION %I.restaurant_order_item_paid_guard() SET search_path = %s',s,path);
 FOREACH t IN ARRAY ARRAY['menu_modifier_groups','menu_modifiers','menu_item_modifier_groups','restaurant_order_item_modifiers','restaurant_payment_items'] LOOP
  EXECUTE format('CREATE TRIGGER restaurant_modifier_guard BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION restaurant_modifier_guard()',t);
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 END LOOP;
END $$;
CREATE TRIGGER restaurant_payment_items_release AFTER UPDATE OF "status" ON "restaurant_payments"
  FOR EACH ROW EXECUTE FUNCTION restaurant_payment_items_release();
CREATE TRIGGER restaurant_order_item_paid_guard BEFORE DELETE ON "restaurant_order_items"
  FOR EACH ROW EXECUTE FUNCTION restaurant_order_item_paid_guard();

-- RLS как у соседних таблиц ресторана (миграция 81): бизнес своей организации, строки через родителя
CREATE POLICY rls_tenant ON menu_modifier_groups TO wetop_app USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id=business_id AND b.organization_id=app_current_org()));
CREATE POLICY rls_tenant ON menu_modifiers TO wetop_app USING (EXISTS (SELECT 1 FROM menu_modifier_groups g WHERE g.id=group_id));
CREATE POLICY rls_tenant ON menu_item_modifier_groups TO wetop_app USING (EXISTS (SELECT 1 FROM menu_items m WHERE m.id=menu_item_id));
CREATE POLICY rls_tenant ON restaurant_order_item_modifiers TO wetop_app USING (EXISTS (SELECT 1 FROM restaurant_order_items i WHERE i.id=order_item_id));
CREATE POLICY rls_tenant ON restaurant_payment_items TO wetop_app USING (EXISTS (SELECT 1 FROM restaurant_payments p WHERE p.id=payment_id));

-- Права как у соседних restaurant_* (миграции 82 и 87); строки платежа не удаляются (как платежи)
REVOKE ALL ON menu_modifier_groups, menu_modifiers, menu_item_modifier_groups, restaurant_order_item_modifiers, restaurant_payment_items FROM wetop_app, wetop_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON menu_modifier_groups, menu_modifiers, menu_item_modifier_groups, restaurant_order_item_modifiers TO wetop_app, wetop_service;
GRANT SELECT, INSERT, UPDATE ON restaurant_payment_items TO wetop_app, wetop_service;

COMMIT;
