-- ADR-MKT-B7, DATA_MODEL §51 (v2.35): чеки и файлы расходов маркетинга. Хранилище и обработка те же, что у
-- property_media (§32.3): в базе только ключ объекта закрытого хранилища. Строки уходят вместе с расходом
-- (CASCADE: расход по §41.1 удаляется физически), объекты в хранилище остаются. Права ролей миграцией 119.
-- Откат: down.sql. На рабочей базе применяет владелец (AGENTS.md §15).

-- CreateTable
CREATE TABLE "marketing_expense_files" (
    "id" UUID NOT NULL,
    "expense_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "file_name" VARCHAR(200) NOT NULL,
    "mime_type" VARCHAR(40) NOT NULL,
    "storage_ref" VARCHAR(500) NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sha256" CHAR(64) NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_expense_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marketing_expense_files_storage_ref_key" ON "marketing_expense_files"("storage_ref");
CREATE UNIQUE INDEX "marketing_expense_files_expense_id_sha256_key" ON "marketing_expense_files"("expense_id", "sha256");

-- AddForeignKey
ALTER TABLE "marketing_expense_files" ADD CONSTRAINT "marketing_expense_files_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "marketing_expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketing_expense_files" ADD CONSTRAINT "marketing_expense_files_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketing_expense_files" ADD CONSTRAINT "marketing_expense_files_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Ключ выводится из строки целиком (как §32.3): нельзя сослаться на чужой объект хранилища
ALTER TABLE "marketing_expense_files"
  ADD CONSTRAINT "marketing_expense_files_mime" CHECK ("mime_type" IN ('image/webp', 'application/pdf')),
  ADD CONSTRAINT "marketing_expense_files_size" CHECK ("byte_size" BETWEEN 1 AND 10485760),
  ADD CONSTRAINT "marketing_expense_files_sha256" CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "marketing_expense_files_name" CHECK (length(btrim("file_name")) > 0),
  ADD CONSTRAINT "marketing_expense_files_ref" CHECK (
    "storage_ref" = 'marketing-expense-files/' || "location_id" || '/' || "id" || '/' || "sha256" ||
      CASE "mime_type" WHEN 'image/webp' THEN '.webp' ELSE '.pdf' END);

-- Изоляция (ADR-103): через филиал → бизнес → организация, как у §41
ALTER TABLE "marketing_expense_files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marketing_expense_files" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "marketing_expense_files" TO wetop_app USING (EXISTS (
  SELECT 1 FROM locations l JOIN businesses b ON b.id = l.business_id
   WHERE l.id = location_id AND b.organization_id = app_current_org()));
