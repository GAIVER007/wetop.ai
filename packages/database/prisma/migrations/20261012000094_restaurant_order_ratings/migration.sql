-- Оценка официанта гостем (DATA_MODEL §39, v2.22, ADR-169)

-- CreateTable
CREATE TABLE "restaurant_order_ratings" (
    "order_id" UUID NOT NULL,
    "waiter_id" UUID,
    "stars" SMALLINT NOT NULL,
    "comment" VARCHAR(500),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "restaurant_order_ratings_pkey" PRIMARY KEY ("order_id")
);
-- CreateIndex
CREATE INDEX "restaurant_order_ratings_waiter_id_idx" ON "restaurant_order_ratings"("waiter_id");
-- AddForeignKey
ALTER TABLE "restaurant_order_ratings" ADD CONSTRAINT "restaurant_order_ratings_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "restaurant_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "restaurant_order_ratings" ADD CONSTRAINT "restaurant_order_ratings_waiter_id_fkey" FOREIGN KEY ("waiter_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "restaurant_order_ratings" ADD CONSTRAINT "restaurant_order_ratings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Значения
ALTER TABLE restaurant_order_ratings ADD CONSTRAINT restaurant_order_ratings_values CHECK (
  stars BETWEEN 1 AND 5 AND (comment IS NULL OR btrim(comment) <> '')
);

-- Только закрытый заказ; официант снимка совпадает с официантом заказа
CREATE FUNCTION restaurant_rating_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE o restaurant_orders%ROWTYPE;
BEGIN
 SELECT * INTO o FROM restaurant_orders WHERE id = NEW.order_id;
 IF o.status <> 'CLOSED' THEN RAISE EXCEPTION 'Rating requires a closed order'; END IF;
 IF NEW.waiter_id IS DISTINCT FROM o.waiter_id THEN RAISE EXCEPTION 'Rating waiter must be the order waiter'; END IF;
 RETURN NEW;
END $$;

DO $$
DECLARE s text := current_schema(); path text;
BEGIN
 path := CASE WHEN s='public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp',s) END;
 EXECUTE format('ALTER FUNCTION %I.restaurant_rating_guard() SET search_path = %s',s,path);
END $$;
CREATE TRIGGER restaurant_rating_guard BEFORE INSERT ON restaurant_order_ratings FOR EACH ROW EXECUTE FUNCTION restaurant_rating_guard();
ALTER TABLE restaurant_order_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_order_ratings FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON restaurant_order_ratings TO wetop_app USING (EXISTS (SELECT 1 FROM restaurant_orders o WHERE o.id=order_id));
