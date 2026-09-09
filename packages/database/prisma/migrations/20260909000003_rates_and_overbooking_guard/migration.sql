-- CreateTable
CREATE TABLE "rate_plans" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "meal_plan" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "exely_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rate_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_plan_accommodation_types" (
    "rate_plan_id" UUID NOT NULL,
    "accommodation_type_id" UUID NOT NULL,

    CONSTRAINT "rate_plan_accommodation_types_pkey" PRIMARY KEY ("rate_plan_id","accommodation_type_id")
);

-- CreateTable
CREATE TABLE "daily_rates" (
    "date" DATE NOT NULL,
    "accommodation_type_id" UUID NOT NULL,
    "rate_plan_id" UUID NOT NULL,
    "occupancy" INTEGER NOT NULL DEFAULT 1,
    "price" BIGINT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "daily_rates_pkey" PRIMARY KEY ("date","accommodation_type_id","rate_plan_id","occupancy")
);

-- CreateTable
CREATE TABLE "restrictions" (
    "date" DATE NOT NULL,
    "accommodation_type_id" UUID NOT NULL,
    "rate_plan_id" UUID NOT NULL,
    "min_stay" INTEGER,
    "max_stay" INTEGER,
    "stop_sell" BOOLEAN NOT NULL DEFAULT false,
    "closed_to_arrival" BOOLEAN NOT NULL DEFAULT false,
    "closed_to_departure" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "restrictions_pkey" PRIMARY KEY ("date","accommodation_type_id","rate_plan_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rate_plans_property_id_code_key" ON "rate_plans"("property_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "rate_plans_property_id_exely_id_key" ON "rate_plans"("property_id", "exely_id");

-- CreateIndex
CREATE INDEX "daily_rates_accommodation_type_id_date_idx" ON "daily_rates"("accommodation_type_id", "date");

-- CreateIndex
CREATE INDEX "restrictions_accommodation_type_id_date_idx" ON "restrictions"("accommodation_type_id", "date");

-- AddForeignKey
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_plan_accommodation_types" ADD CONSTRAINT "rate_plan_accommodation_types_rate_plan_id_fkey" FOREIGN KEY ("rate_plan_id") REFERENCES "rate_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_plan_accommodation_types" ADD CONSTRAINT "rate_plan_accommodation_types_accommodation_type_id_fkey" FOREIGN KEY ("accommodation_type_id") REFERENCES "accommodation_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_rates" ADD CONSTRAINT "daily_rates_accommodation_type_id_fkey" FOREIGN KEY ("accommodation_type_id") REFERENCES "accommodation_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_rates" ADD CONSTRAINT "daily_rates_rate_plan_id_fkey" FOREIGN KEY ("rate_plan_id") REFERENCES "rate_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restrictions" ADD CONSTRAINT "restrictions_accommodation_type_id_fkey" FOREIGN KEY ("accommodation_type_id") REFERENCES "accommodation_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restrictions" ADD CONSTRAINT "restrictions_rate_plan_id_fkey" FOREIGN KEY ("rate_plan_id") REFERENCES "rate_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Вне Prisma: запрет овербукинга на уровне БД (PLAN.md риск №3/№6, бриф часть 6 п.3).
-- Два назначения на одну ячейку с пересекающимися ночами невозможны физически:
-- exclusion constraint по (inventory_unit_id, daterange[start_date, end_date)).
-- Prisma такие ограничения не описывает — держим здесь и в down.sql.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "allocations"
  ADD CONSTRAINT "allocations_no_overlap_per_unit"
  EXCLUDE USING gist (
    "inventory_unit_id" WITH =,
    daterange("start_date", "end_date", '[)') WITH &&
  );
