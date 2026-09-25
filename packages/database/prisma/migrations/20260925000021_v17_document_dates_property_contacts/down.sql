-- Откат 20260925000021_v17_document_dates_property_contacts (выполняет владелец).
--
-- guest_documents пересоздаётся, а не правится ALTER-ами: DROP снял issued_at/expires_at из середины
-- таблицы, и простое ADD вернуло бы их в конец — снимок схемы (pg_dump -s, сторож check-migrations.sh)
-- не совпал бы с прежним. Данные копируются; шифрованные даты в DATE не расшифровать SQL-ем — на дату
-- миграции документов в базе 0 (ADR-072), а если откат делается позже и строки есть, их даты переносит
-- приложение отдельно ДО отката, иначе даты будут потеряны (номер и остальные поля сохраняются).

BEGIN;

CREATE TABLE "guest_documents_v16" (
    "id" UUID NOT NULL,
    "guest_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "number_encrypted" TEXT NOT NULL,
    "issue_country" VARCHAR(3),
    "issued_at" DATE,
    "expires_at" DATE,
    "document_file_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Имя pkey занято старой таблицей до её DROP: создаём под временным, ниже переименуем
    CONSTRAINT "guest_documents_v16_pkey" PRIMARY KEY ("id")
);

INSERT INTO "guest_documents_v16"
    ("id", "guest_id", "type", "number_encrypted", "issue_country", "issued_at", "expires_at",
     "document_file_id", "created_at")
SELECT "id", "guest_id", "type", "number_encrypted", "issue_country", NULL, NULL,
       "document_file_id", "created_at"
FROM "guest_documents";

DROP TABLE "guest_documents";
ALTER TABLE "guest_documents_v16" RENAME TO "guest_documents";
ALTER TABLE "guest_documents" RENAME CONSTRAINT "guest_documents_v16_pkey" TO "guest_documents_pkey";

-- Индекс, внешний ключ и проверка страны — с исходными именами (20260908000002 и 20260913000011)
CREATE INDEX "guest_documents_guest_id_idx" ON "guest_documents"("guest_id");
ALTER TABLE "guest_documents"
  ADD CONSTRAINT "guest_documents_guest_id_fkey"
  FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "guest_documents"
  ADD CONSTRAINT "guest_documents_issue_country_alpha3"
  CHECK ("issue_country" IS NULL OR "issue_country" ~ '^[A-Z]{3}$');

ALTER TABLE "properties" DROP COLUMN "phone";
ALTER TABLE "properties" DROP COLUMN "email";

COMMIT;
