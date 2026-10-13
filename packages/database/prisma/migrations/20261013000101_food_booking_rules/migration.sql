-- Правила брони столов (DATA_MODEL §43, v2.26, ADR-177): буфер, горизонт, максимум гостей, закрытые дни

-- CreateTable
CREATE TABLE "food_booking_rules" (
    "location_id" UUID NOT NULL,
    "buffer_minutes" SMALLINT NOT NULL DEFAULT 0,
    "horizon_days" SMALLINT,
    "max_party_size" SMALLINT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "food_booking_rules_pkey" PRIMARY KEY ("location_id")
);

-- CreateTable
CREATE TABLE "food_closed_days" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "reason" VARCHAR(200),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "food_closed_days_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "food_closed_days_location_id_day_key" ON "food_closed_days"("location_id", "day");

-- AddForeignKey
ALTER TABLE "food_booking_rules" ADD CONSTRAINT "food_booking_rules_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_closed_days" ADD CONSTRAINT "food_closed_days_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE food_booking_rules ADD CONSTRAINT food_booking_rules_values CHECK (
  buffer_minutes BETWEEN 0 AND 240
  AND (horizon_days IS NULL OR horizon_days BETWEEN 1 AND 730)
  AND (max_party_size IS NULL OR max_party_size BETWEEN 1 AND 500)
);
ALTER TABLE food_closed_days ADD CONSTRAINT food_closed_days_values CHECK (reason IS NULL OR btrim(reason) <> '');

ALTER TABLE food_booking_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_booking_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE food_closed_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_closed_days FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON food_booking_rules TO wetop_app USING (EXISTS (SELECT 1 FROM locations l JOIN businesses b ON b.id=l.business_id WHERE l.id=location_id AND b.organization_id=app_current_org()));
CREATE POLICY rls_tenant ON food_closed_days TO wetop_app USING (EXISTS (SELECT 1 FROM locations l JOIN businesses b ON b.id=l.business_id WHERE l.id=location_id AND b.organization_id=app_current_org()));
