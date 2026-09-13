-- Откат: снять проверку формата и вернуть фиксированную длину.
-- Значения при обратном приведении снова получат дописанные пробелы — это и есть поведение CHAR(3),
-- ради ухода от которого миграция делалась (Q-117). Код после отката продолжит работать:
-- normalizeCitizenship / hasCitizenship считают строку из пробелов пустой.

ALTER TABLE "guests" DROP CONSTRAINT IF EXISTS "guests_citizenship_alpha3";
ALTER TABLE "guest_documents" DROP CONSTRAINT IF EXISTS "guest_documents_issue_country_alpha3";

ALTER TABLE "guests" ALTER COLUMN "citizenship" TYPE CHAR(3);
ALTER TABLE "guest_documents" ALTER COLUMN "issue_country" TYPE CHAR(3);
