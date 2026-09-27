-- Откат Phase 1 изоляции (миграция 20260927000026_phase1_tenant_scope, ADR-100 §17.2).
-- Откатывать только вместе с кодом до Phase 1: репозитории после Phase 1 фильтруют по этим колонкам.
-- Данные броней, гостей, денег и содержимое журнала не затрагиваются — снимаются только новые колонки.

DROP INDEX IF EXISTS "guests_organization_id_idx";
ALTER TABLE "guests" DROP CONSTRAINT IF EXISTS "guests_organization_id_fkey";
ALTER TABLE "guests" DROP COLUMN IF EXISTS "organization_id";

-- Снятие колонки журнала — DDL: триггер audit_logs_immutable на него не срабатывает и остаётся на месте
DROP INDEX IF EXISTS "audit_logs_organization_id_idx";
ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_organization_id_fkey";
ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "organization_id";

DROP INDEX IF EXISTS "external_events_property_id_idx";
ALTER TABLE "external_events" DROP CONSTRAINT IF EXISTS "external_events_property_id_fkey";
ALTER TABLE "external_events" DROP COLUMN IF EXISTS "property_id";

DROP INDEX IF EXISTS "channel_outbox_property_id_idx";
ALTER TABLE "channel_outbox" DROP CONSTRAINT IF EXISTS "channel_outbox_property_id_fkey";
ALTER TABLE "channel_outbox" DROP COLUMN IF EXISTS "property_id";
