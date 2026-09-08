-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AccommodationKind" AS ENUM ('PRIVATE_ROOM', 'DORM_BED', 'APARTMENT');

-- CreateEnum
CREATE TYPE "InventoryUnitKind" AS ENUM ('ROOM', 'BED');

-- CreateEnum
CREATE TYPE "HousekeepingStatus" AS ENUM ('DIRTY', 'CLEAN', 'INSPECTED');

-- CreateEnum
CREATE TYPE "InventoryBlockType" AS ENUM ('MAINTENANCE', 'MANAGEMENT', 'OUT_OF_ORDER', 'OTHER');

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "legal_name" TEXT,
    "bin" TEXT,
    "address" TEXT,
    "timezone" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "check_in_time" TEXT NOT NULL,
    "check_out_time" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buildings" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "floors" (
    "id" UUID NOT NULL,
    "building_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "floors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accommodation_types" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "AccommodationKind" NOT NULL,
    "capacity_adults" INTEGER NOT NULL,
    "capacity_children" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "exely_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "accommodation_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "physical_rooms" (
    "id" UUID NOT NULL,
    "floor_id" UUID NOT NULL,
    "room_number" TEXT NOT NULL,
    "name" TEXT,
    "capacity" INTEGER NOT NULL,
    "is_dorm" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "physical_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_units" (
    "id" UUID NOT NULL,
    "physical_room_id" UUID NOT NULL,
    "accommodation_type_id" UUID NOT NULL,
    "kind" "InventoryUnitKind" NOT NULL,
    "code" TEXT NOT NULL,
    "housekeeping_status" "HousekeepingStatus" NOT NULL DEFAULT 'DIRTY',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "exely_room_number" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inventory_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "housekeeping_events" (
    "id" UUID NOT NULL,
    "inventory_unit_id" UUID NOT NULL,
    "from_status" "HousekeepingStatus" NOT NULL,
    "to_status" "HousekeepingStatus" NOT NULL,
    "user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "housekeeping_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_blocks" (
    "id" UUID NOT NULL,
    "inventory_unit_id" UUID NOT NULL,
    "date_from" DATE NOT NULL,
    "date_to" DATE NOT NULL,
    "reason" TEXT,
    "type" "InventoryBlockType" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "buildings_property_id_name_key" ON "buildings"("property_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "floors_building_id_name_key" ON "floors"("building_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "accommodation_types_property_id_code_key" ON "accommodation_types"("property_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "accommodation_types_property_id_exely_id_key" ON "accommodation_types"("property_id", "exely_id");

-- CreateIndex
CREATE UNIQUE INDEX "physical_rooms_floor_id_room_number_key" ON "physical_rooms"("floor_id", "room_number");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_units_code_key" ON "inventory_units"("code");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_units_exely_room_number_key" ON "inventory_units"("exely_room_number");

-- CreateIndex
CREATE INDEX "inventory_units_accommodation_type_id_idx" ON "inventory_units"("accommodation_type_id");

-- CreateIndex
CREATE INDEX "inventory_units_physical_room_id_idx" ON "inventory_units"("physical_room_id");

-- CreateIndex
CREATE INDEX "housekeeping_events_inventory_unit_id_created_at_idx" ON "housekeeping_events"("inventory_unit_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_blocks_inventory_unit_id_date_from_date_to_idx" ON "inventory_blocks"("inventory_unit_id", "date_from", "date_to");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floors" ADD CONSTRAINT "floors_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accommodation_types" ADD CONSTRAINT "accommodation_types_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physical_rooms" ADD CONSTRAINT "physical_rooms_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "floors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_units" ADD CONSTRAINT "inventory_units_physical_room_id_fkey" FOREIGN KEY ("physical_room_id") REFERENCES "physical_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_units" ADD CONSTRAINT "inventory_units_accommodation_type_id_fkey" FOREIGN KEY ("accommodation_type_id") REFERENCES "accommodation_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "housekeeping_events" ADD CONSTRAINT "housekeeping_events_inventory_unit_id_fkey" FOREIGN KEY ("inventory_unit_id") REFERENCES "inventory_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_blocks" ADD CONSTRAINT "inventory_blocks_inventory_unit_id_fkey" FOREIGN KEY ("inventory_unit_id") REFERENCES "inventory_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
