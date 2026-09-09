-- DropForeignKey
ALTER TABLE "folios" DROP CONSTRAINT "folios_reservation_item_id_fkey";

-- DropForeignKey
ALTER TABLE "services" DROP CONSTRAINT "services_property_id_fkey";

-- DropForeignKey
ALTER TABLE "charges" DROP CONSTRAINT "charges_folio_id_fkey";

-- DropForeignKey
ALTER TABLE "charges" DROP CONSTRAINT "charges_service_id_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_property_id_fkey";

-- DropForeignKey
ALTER TABLE "payment_allocations" DROP CONSTRAINT "payment_allocations_payment_id_fkey";

-- DropForeignKey
ALTER TABLE "payment_allocations" DROP CONSTRAINT "payment_allocations_folio_id_fkey";

-- DropForeignKey
ALTER TABLE "refunds" DROP CONSTRAINT "refunds_payment_id_fkey";

-- DropForeignKey
ALTER TABLE "refunds" DROP CONSTRAINT "refunds_folio_id_fkey";

-- DropTable
DROP TABLE "folios";

-- DropTable
DROP TABLE "services";

-- DropTable
DROP TABLE "charges";

-- DropTable
DROP TABLE "payments";

-- DropTable
DROP TABLE "payment_allocations";

-- DropTable
DROP TABLE "refunds";

-- DropEnum
DROP TYPE "FolioStatus";

-- DropEnum
DROP TYPE "ChargeKind";

-- DropEnum
DROP TYPE "PaymentMethod";

-- DropEnum
DROP TYPE "PaymentStatus";

