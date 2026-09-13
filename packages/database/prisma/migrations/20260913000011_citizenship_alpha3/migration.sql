-- Гражданство и страна выдачи документа: CHAR(3) → VARCHAR(3) плюс проверка формата (DATA_MODEL §3, Q-117).
--
-- Зачем. CHAR(3) — тип фиксированной длины: Postgres дополняет пустую строку до '   ' и так её и отдаёт.
-- В JS такая строка истинна, поэтому проверка «гражданство указано» пропускала гостя без кода страны;
-- 401 запись пришла такой из импорта Exely (reports/citizenship-blank-2026-09-12.md, чистка 13.09.2026).
-- Теперь «не указано» хранится только как NULL, а код обязан быть ISO 3166-1 alpha-3.
--
-- Данные на момент миграции (dev-БД, 13.09.2026): 1442 NULL, 478 кодов alpha-3, нарушений формата нет.
-- Приведение NULLIF(btrim(...), '') оставлено на случай, если где-то ещё осталось значение с пробелами.
-- Откат — down.sql в этой же папке.

UPDATE "guests" SET "citizenship" = NULLIF(btrim("citizenship"), '') WHERE "citizenship" IS NOT NULL;
UPDATE "guest_documents" SET "issue_country" = NULLIF(btrim("issue_country"), '') WHERE "issue_country" IS NOT NULL;

ALTER TABLE "guests"
  ALTER COLUMN "citizenship" TYPE VARCHAR(3) USING NULLIF(btrim("citizenship"), '');
ALTER TABLE "guest_documents"
  ALTER COLUMN "issue_country" TYPE VARCHAR(3) USING NULLIF(btrim("issue_country"), '');

ALTER TABLE "guests"
  ADD CONSTRAINT "guests_citizenship_alpha3"
  CHECK ("citizenship" IS NULL OR "citizenship" ~ '^[A-Z]{3}$');
ALTER TABLE "guest_documents"
  ADD CONSTRAINT "guest_documents_issue_country_alpha3"
  CHECK ("issue_country" IS NULL OR "issue_country" ~ '^[A-Z]{3}$');
