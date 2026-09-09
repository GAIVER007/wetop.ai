-- CreateEnum
CREATE TYPE "ExternalEventStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "channel_mappings" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "channel" TEXT,
    "local_accommodation_type_id" UUID,
    "local_rate_plan_id" UUID,
    "provider_property_id" TEXT NOT NULL,
    "provider_room_type_id" TEXT,
    "provider_rate_plan_id" TEXT,
    "channel_property_id" TEXT,
    "channel_room_id" TEXT,
    "channel_rate_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "channel_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_events" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "external_event_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload_hash" TEXT NOT NULL,
    "payload" JSONB,
    "status" "ExternalEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "processed_at" TIMESTAMPTZ(6),

    CONSTRAINT "external_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "channel_mappings_property_id_provider_idx" ON "channel_mappings"("property_id", "provider");

-- CreateIndex
CREATE INDEX "channel_mappings_local_accommodation_type_id_idx" ON "channel_mappings"("local_accommodation_type_id");

-- CreateIndex
CREATE INDEX "channel_mappings_local_rate_plan_id_idx" ON "channel_mappings"("local_rate_plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "channel_mappings_provider_provider_rate_plan_id_key" ON "channel_mappings"("provider", "provider_rate_plan_id");

-- CreateIndex
CREATE INDEX "external_events_status_received_at_idx" ON "external_events"("status", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "external_events_provider_external_event_id_key" ON "external_events"("provider", "external_event_id");

-- AddForeignKey
ALTER TABLE "channel_mappings" ADD CONSTRAINT "channel_mappings_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_mappings" ADD CONSTRAINT "channel_mappings_local_accommodation_type_id_fkey" FOREIGN KEY ("local_accommodation_type_id") REFERENCES "accommodation_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_mappings" ADD CONSTRAINT "channel_mappings_local_rate_plan_id_fkey" FOREIGN KEY ("local_rate_plan_id") REFERENCES "rate_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

