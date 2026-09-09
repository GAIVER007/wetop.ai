-- DropForeignKey
ALTER TABLE "channel_mappings" DROP CONSTRAINT "channel_mappings_property_id_fkey";

-- DropForeignKey
ALTER TABLE "channel_mappings" DROP CONSTRAINT "channel_mappings_local_accommodation_type_id_fkey";

-- DropForeignKey
ALTER TABLE "channel_mappings" DROP CONSTRAINT "channel_mappings_local_rate_plan_id_fkey";

-- DropTable
DROP TABLE "channel_mappings";

-- DropTable
DROP TABLE "external_events";

-- DropEnum
DROP TYPE "ExternalEventStatus";

