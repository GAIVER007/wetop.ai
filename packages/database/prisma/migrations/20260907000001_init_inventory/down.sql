-- DropForeignKey
ALTER TABLE "public"."buildings" DROP CONSTRAINT "buildings_property_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."floors" DROP CONSTRAINT "floors_building_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."accommodation_types" DROP CONSTRAINT "accommodation_types_property_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."physical_rooms" DROP CONSTRAINT "physical_rooms_floor_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."inventory_units" DROP CONSTRAINT "inventory_units_physical_room_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."inventory_units" DROP CONSTRAINT "inventory_units_accommodation_type_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."housekeeping_events" DROP CONSTRAINT "housekeeping_events_inventory_unit_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."inventory_blocks" DROP CONSTRAINT "inventory_blocks_inventory_unit_id_fkey";

-- DropTable
DROP TABLE "public"."properties";

-- DropTable
DROP TABLE "public"."buildings";

-- DropTable
DROP TABLE "public"."floors";

-- DropTable
DROP TABLE "public"."accommodation_types";

-- DropTable
DROP TABLE "public"."physical_rooms";

-- DropTable
DROP TABLE "public"."inventory_units";

-- DropTable
DROP TABLE "public"."housekeeping_events";

-- DropTable
DROP TABLE "public"."inventory_blocks";

-- DropTable
DROP TABLE "public"."audit_logs";

-- DropEnum
DROP TYPE "public"."AccommodationKind";

-- DropEnum
DROP TYPE "public"."InventoryUnitKind";

-- DropEnum
DROP TYPE "public"."HousekeepingStatus";

-- DropEnum
DROP TYPE "public"."InventoryBlockType";
