-- DATA_MODEL v1.7 (24.09, утверждено 25.09.2026 — ADR-082; план plans/data-model-v17-2026-09-25.md).
-- Применяет владелец (AGENTS.md §15): бэкап → миграция → проверка → откат (down.sql в этой же папке).
--
-- Две части:
--   • §3 — даты документа гостя шифрованием, как номер: вместо открытых DATE — TEXT с ISO-датой,
--     зашифрованной ключом PII_ENCRYPTION_KEY (AES-256-GCM, packages/shared/src/pii-crypto.ts).
--     Переноса данных нет: в рабочей базе документов 0 (ADR-072 — до базы в РК документы не принимаются),
--     поэтому старые колонки снимаются без выгрузки;
--   • §1 — телефон и почта объекта для печатных форм: до этого они были зашиты в код печати
--     (apps/web/.../print/forms.ts) и напечатались бы в договоре любой организации. Значения Luxx
--     переносятся из кода в запись самой старой гостиницы — те же строки, что жили в git.

-- §3: даты документа шифрованием
ALTER TABLE "guest_documents" ADD COLUMN "issued_at_encrypted" TEXT;
ALTER TABLE "guest_documents" ADD COLUMN "expires_at_encrypted" TEXT;
ALTER TABLE "guest_documents" DROP COLUMN "issued_at";
ALTER TABLE "guest_documents" DROP COLUMN "expires_at";

-- §1: контакты объекта
ALTER TABLE "properties" ADD COLUMN "phone" TEXT;
ALTER TABLE "properties" ADD COLUMN "email" TEXT;

-- Значения Luxx — в запись самой старой гостиницы (как v1.6 привязывала объекты к самой старой организации).
-- Новым организациям ничего не проставляется: пустое печатается прочерком.
UPDATE "properties"
SET "phone" = '+7 777 187 77 65', "email" = 'luxxaparts@gmail.com'
WHERE "id" = (SELECT "id" FROM "properties" ORDER BY "created_at", "id" LIMIT 1)
  AND "phone" IS NULL AND "email" IS NULL;
