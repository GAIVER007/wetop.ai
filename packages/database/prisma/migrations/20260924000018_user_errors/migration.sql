-- Ошибки, которые видит человек (DATA_MODEL §14 v1.8, ТЗ ред. 1 П3, ADR-078). Применяет владелец (AGENTS.md §15).
--
-- Журнал отказов API, которые получил вошедший человек: 4xx и 5xx. Его читает ИИ-помощник по узкому ключу, чтобы
-- ответить «что у меня сломалось». Техническая таблица: существующие таблицы не меняются, данных гостей нет —
-- маршрут шаблоном и текст ответа с маской. Хранение 30 суток (уборка в API). Откат — down.sql в этой же папке.

-- CreateTable
CREATE TABLE "user_errors" (
    "id" UUID NOT NULL,
    "at" TIMESTAMPTZ(6) NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "route" VARCHAR(200) NOT NULL,
    "status" SMALLINT NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "request_id" UUID NOT NULL,

    CONSTRAINT "user_errors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_errors_user_id_organization_id_at_idx" ON "user_errors"("user_id", "organization_id", "at");

-- CreateIndex
CREATE INDEX "user_errors_at_idx" ON "user_errors"("at");

-- AddForeignKey
ALTER TABLE "user_errors" ADD CONSTRAINT "user_errors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_errors" ADD CONSTRAINT "user_errors_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Журнал — только об ошибках: код ответа 400…599. Prisma CHECK не описывает.
ALTER TABLE "user_errors" ADD CONSTRAINT "user_errors_status_check" CHECK ("status" BETWEEN 400 AND 599);
