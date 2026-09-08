-- DropForeignKey
ALTER TABLE "reservations" DROP CONSTRAINT "reservations_property_id_fkey";

-- DropForeignKey
ALTER TABLE "reservations" DROP CONSTRAINT "reservations_primary_guest_id_fkey";

-- DropForeignKey
ALTER TABLE "reservation_items" DROP CONSTRAINT "reservation_items_reservation_id_fkey";

-- DropForeignKey
ALTER TABLE "reservation_items" DROP CONSTRAINT "reservation_items_accommodation_type_id_fkey";

-- DropForeignKey
ALTER TABLE "stay_guests" DROP CONSTRAINT "stay_guests_reservation_item_id_fkey";

-- DropForeignKey
ALTER TABLE "stay_guests" DROP CONSTRAINT "stay_guests_guest_id_fkey";

-- DropForeignKey
ALTER TABLE "allocations" DROP CONSTRAINT "allocations_reservation_item_id_fkey";

-- DropForeignKey
ALTER TABLE "allocations" DROP CONSTRAINT "allocations_inventory_unit_id_fkey";

-- DropForeignKey
ALTER TABLE "guest_documents" DROP CONSTRAINT "guest_documents_guest_id_fkey";

-- DropTable
DROP TABLE "reservations";

-- DropTable
DROP TABLE "reservation_items";

-- DropTable
DROP TABLE "stay_guests";

-- DropTable
DROP TABLE "allocations";

-- DropTable
DROP TABLE "guests";

-- DropTable
DROP TABLE "guest_documents";

-- DropEnum
DROP TYPE "ReservationSource";

-- DropEnum
DROP TYPE "ReservationStatus";

-- DropEnum
DROP TYPE "Gender";
