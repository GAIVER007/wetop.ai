-- CreateEnum
CREATE TYPE "ReservationSource" AS ENUM ('DESK', 'PHONE', 'WHATSAPP', 'WALK_IN', 'INSTAGRAM', 'OTA', 'WEBSITE');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('TENTATIVE', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'UNKNOWN');

-- CreateTable
CREATE TABLE "reservations" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "confirmation_number" TEXT NOT NULL,
    "source" "ReservationSource" NOT NULL,
    "channel" TEXT,
    "external_id" TEXT,
    "status" "ReservationStatus" NOT NULL,
    "booked_at" TIMESTAMPTZ(6),
    "arrival_date" DATE NOT NULL,
    "departure_date" DATE NOT NULL,
    "adults" INTEGER NOT NULL,
    "children" INTEGER NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL,
    "total_amount" BIGINT NOT NULL,
    "primary_guest_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_items" (
    "id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "accommodation_type_id" UUID NOT NULL,
    "arrival_date" DATE NOT NULL,
    "departure_date" DATE NOT NULL,
    "price" BIGINT NOT NULL,
    "status" "ReservationStatus" NOT NULL,
    "exely_room_stay_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reservation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stay_guests" (
    "reservation_item_id" UUID NOT NULL,
    "guest_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "stay_guests_pkey" PRIMARY KEY ("reservation_item_id","guest_id")
);

-- CreateTable
CREATE TABLE "allocations" (
    "id" UUID NOT NULL,
    "reservation_item_id" UUID NOT NULL,
    "inventory_unit_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guests" (
    "id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "birth_date" DATE,
    "citizenship" CHAR(3),
    "gender" "Gender" NOT NULL DEFAULT 'UNKNOWN',
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "exely_person_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "guests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_documents" (
    "id" UUID NOT NULL,
    "guest_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "number_encrypted" TEXT NOT NULL,
    "issue_country" CHAR(3),
    "issued_at" DATE,
    "expires_at" DATE,
    "document_file_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reservations_property_id_arrival_date_idx" ON "reservations"("property_id", "arrival_date");

-- CreateIndex
CREATE INDEX "reservations_property_id_departure_date_idx" ON "reservations"("property_id", "departure_date");

-- CreateIndex
CREATE INDEX "reservations_status_idx" ON "reservations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_property_id_confirmation_number_key" ON "reservations"("property_id", "confirmation_number");

-- CreateIndex
CREATE UNIQUE INDEX "reservation_items_exely_room_stay_id_key" ON "reservation_items"("exely_room_stay_id");

-- CreateIndex
CREATE INDEX "reservation_items_reservation_id_idx" ON "reservation_items"("reservation_id");

-- CreateIndex
CREATE INDEX "reservation_items_accommodation_type_id_arrival_date_depart_idx" ON "reservation_items"("accommodation_type_id", "arrival_date", "departure_date");

-- CreateIndex
CREATE INDEX "stay_guests_guest_id_idx" ON "stay_guests"("guest_id");

-- CreateIndex
CREATE INDEX "allocations_inventory_unit_id_start_date_end_date_idx" ON "allocations"("inventory_unit_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "allocations_reservation_item_id_idx" ON "allocations"("reservation_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "guests_exely_person_id_key" ON "guests"("exely_person_id");

-- CreateIndex
CREATE INDEX "guests_last_name_first_name_idx" ON "guests"("last_name", "first_name");

-- CreateIndex
CREATE INDEX "guests_phone_idx" ON "guests"("phone");

-- CreateIndex
CREATE INDEX "guest_documents_guest_id_idx" ON "guest_documents"("guest_id");

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_primary_guest_id_fkey" FOREIGN KEY ("primary_guest_id") REFERENCES "guests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_items" ADD CONSTRAINT "reservation_items_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_items" ADD CONSTRAINT "reservation_items_accommodation_type_id_fkey" FOREIGN KEY ("accommodation_type_id") REFERENCES "accommodation_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stay_guests" ADD CONSTRAINT "stay_guests_reservation_item_id_fkey" FOREIGN KEY ("reservation_item_id") REFERENCES "reservation_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stay_guests" ADD CONSTRAINT "stay_guests_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_reservation_item_id_fkey" FOREIGN KEY ("reservation_item_id") REFERENCES "reservation_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_inventory_unit_id_fkey" FOREIGN KEY ("inventory_unit_id") REFERENCES "inventory_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_documents" ADD CONSTRAINT "guest_documents_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
