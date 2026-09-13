-- Неисправности системы (DATA_MODEL §12 v1.4, срез 11, ADR-028, поручение владельца 13.09.2026 «делай»).
--
-- Одно место, куда сторож системы пишет всё, что сломалось. Техническая таблица, как channel_outbox:
-- бизнес-данных не хранит, старые таблицы не трогаются. Откат — down.sql в этой же папке.

-- CreateEnum
CREATE TYPE "IncidentClass" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('CRITICAL', 'WARNING');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'FIXING', 'ESCALATED', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "IncidentResolvedBy" AS ENUM ('GUARD', 'AGENT', 'STAFF');

-- CreateTable
CREATE TABLE "system_incidents" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "class" "IncidentClass" NOT NULL,
    "severity" "IncidentSeverity" NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "subject_type" TEXT,
    "subject_id" TEXT,
    "details" JSONB,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fix_attempts" INTEGER NOT NULL DEFAULT 0,
    "last_fix_at" TIMESTAMPTZ(6),
    "last_fix_result" TEXT,
    "alerted_at" TIMESTAMPTZ(6),
    "acknowledged_at" TIMESTAMPTZ(6),
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_by" "IncidentResolvedBy",

    CONSTRAINT "system_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "system_incidents_status_severity_idx" ON "system_incidents"("status", "severity");

-- CreateIndex
CREATE INDEX "system_incidents_kind_first_seen_at_idx" ON "system_incidents"("kind", "first_seen_at");

-- CreateIndex
CREATE INDEX "system_incidents_resolved_at_idx" ON "system_incidents"("resolved_at");

-- Одна открытая строка на неисправность: повтор с тем же отпечатком не плодит строки, пока неисправность
-- не закрыта; закрытая и снова возникшая — новая строка (своя история). Prisma частичный индекс не описывает.
CREATE UNIQUE INDEX "system_incidents_open_fingerprint_key" ON "system_incidents"("fingerprint") WHERE "status" <> 'RESOLVED';

-- Закрытая неисправность обязана знать, когда и кем закрыта.
ALTER TABLE "system_incidents" ADD CONSTRAINT "system_incidents_resolved_consistent"
  CHECK (("status" = 'RESOLVED') = ("resolved_at" IS NOT NULL AND "resolved_by" IS NOT NULL));
