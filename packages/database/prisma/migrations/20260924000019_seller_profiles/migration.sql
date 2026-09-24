-- Профиль ИИ-продавца (DATA_MODEL §15 v1.8, ТЗ ред. 1 П5; ADR-077, ADR-080). Применяет владелец (AGENTS.md §15).
--
-- Одна строка на организацию: как продавец говорит с гостями и что рассказывает о правилах объекта — поля экрана
-- «Настройки», не текст промпта (ядро правил держит бот). Перечисления и пределы длины — модели бота `SellerProfile`
-- (`src/ai/seller_prompt.py`, `extra='forbid'`): значение вне списка бот отклоняет целиком. Поля доставки (П8) ведёт
-- платформа. Данных гостей нет. Существующие таблицы не меняются. Откат — down.sql в этой же папке.
--
-- 24.09.2026 миграция переписана под утверждённую редакцию §15 (ADR-080): первая редакция (use_emoji, три длины,
-- paid_extras, запреты одним текстом) нигде, кроме локальной базы, не применялась.

-- CreateEnum
CREATE TYPE "SellerAddressForm" AS ENUM ('FORMAL', 'INFORMAL');

-- CreateEnum
CREATE TYPE "SellerEmoji" AS ENUM ('NEVER', 'MODERATE', 'GREETING_ONLY');

-- CreateEnum
CREATE TYPE "SellerReplyLength" AS ENUM ('SHORT', 'DETAILED');

-- CreateTable
CREATE TABLE "seller_profiles" (
    "organization_id" UUID NOT NULL,
    "bot_name" VARCHAR(40),
    "address_form" "SellerAddressForm" NOT NULL,
    "emoji" "SellerEmoji" NOT NULL DEFAULT 'NEVER',
    "reply_length" "SellerReplyLength" NOT NULL,
    "languages" TEXT[],
    "greeting" VARCHAR(300) NOT NULL DEFAULT '',
    "included_in_price" VARCHAR(1000) NOT NULL DEFAULT '',
    "extra_charges" VARCHAR(1000) NOT NULL DEFAULT '',
    "house_rules" VARCHAR(2000) NOT NULL DEFAULT '',
    "prohibitions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "call_human_when" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "faq" JSONB NOT NULL DEFAULT '[]',
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "profile_applied_at" TIMESTAMPTZ(6),
    "facts_hash" CHAR(64),
    "facts_applied_at" TIMESTAMPTZ(6),
    "last_error" VARCHAR(500),
    "last_error_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_profiles_pkey" PRIMARY KEY ("organization_id")
);

-- AddForeignKey
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Языков от одного до шести (DATA_MODEL §15, предел бота). Prisma CHECK не описывает.
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_languages_check"
  CHECK ("languages" IS NOT NULL AND cardinality("languages") BETWEEN 1 AND 6);

-- Запретов и «когда звать человека» — до 30 строк, как у бота; длину строки (до 300) проверяет домен.
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_prohibitions_check"
  CHECK ("prohibitions" IS NOT NULL AND cardinality("prohibitions") <= 30);
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_call_human_when_check"
  CHECK ("call_human_when" IS NOT NULL AND cardinality("call_human_when") <= 30);
