-- Клиент: VIP-метка и дата рождения (DATA_MODEL §36, v2.19, ADR-166)

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "birth_date" DATE,
ADD COLUMN     "is_vip" BOOLEAN NOT NULL DEFAULT false;

-- Не раньше 1900 года; «не в будущем» проверяет API (current_date в CHECK не неизменяем)
ALTER TABLE customers ADD CONSTRAINT customers_birth_date_sane CHECK (birth_date IS NULL OR birth_date >= DATE '1900-01-01');
