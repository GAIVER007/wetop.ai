-- Аналитика сайта (DATA_MODEL §11, срез 8, принят владельцем 12.09.2026): счётчик на сайте объекта →
-- сессии, просмотры, события. Персональных данных нет: IP и полный User-Agent не сохраняются,
-- visitor_key — случайное число из браузера (ADR-018). Существующие таблицы не меняются.
-- SQL получен `prisma migrate diff --from-config-datasource --to-schema` против dev-БД 12.09.2026.


-- CreateEnum
CREATE TYPE "TrackedSiteStatus" AS ENUM ('ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "WebSourceKind" AS ENUM ('DIRECT', 'SEARCH', 'SOCIAL', 'PAID', 'EMAIL', 'REFERRAL');

-- CreateEnum
CREATE TYPE "WebDevice" AS ENUM ('DESKTOP', 'MOBILE', 'TABLET');

-- CreateTable
CREATE TABLE "tracked_sites" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "hosts" TEXT[],
    "public_key" TEXT NOT NULL,
    "status" "TrackedSiteStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tracked_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "web_sessions" (
    "id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "visitor_key" TEXT NOT NULL,
    "session_key" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL,
    "pageviews" INTEGER NOT NULL DEFAULT 0,
    "duration_seconds" INTEGER NOT NULL DEFAULT 0,
    "landing_path" TEXT,
    "referrer_host" TEXT,
    "source_kind" "WebSourceKind" NOT NULL DEFAULT 'DIRECT',
    "source" TEXT,
    "medium" TEXT,
    "campaign" TEXT,
    "content" TEXT,
    "term" TEXT,
    "device" "WebDevice" NOT NULL DEFAULT 'DESKTOP',
    "browser" TEXT,
    "os" TEXT,
    "language" TEXT,

    CONSTRAINT "web_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "web_pageviews" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "at" TIMESTAMPTZ(6) NOT NULL,
    "path" TEXT NOT NULL,
    "title" TEXT,

    CONSTRAINT "web_pageviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "web_events" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "at" TIMESTAMPTZ(6) NOT NULL,
    "name" TEXT NOT NULL,
    "props" JSONB,

    CONSTRAINT "web_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tracked_sites_public_key_key" ON "tracked_sites"("public_key");

-- CreateIndex
CREATE INDEX "tracked_sites_property_id_idx" ON "tracked_sites"("property_id");

-- CreateIndex
CREATE INDEX "web_sessions_site_id_started_at_idx" ON "web_sessions"("site_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "web_sessions_site_id_session_key_key" ON "web_sessions"("site_id", "session_key");

-- CreateIndex
CREATE INDEX "web_pageviews_session_id_idx" ON "web_pageviews"("session_id");

-- CreateIndex
CREATE INDEX "web_pageviews_at_idx" ON "web_pageviews"("at");

-- CreateIndex
CREATE INDEX "web_events_session_id_idx" ON "web_events"("session_id");

-- CreateIndex
CREATE INDEX "web_events_at_idx" ON "web_events"("at");

-- AddForeignKey
ALTER TABLE "tracked_sites" ADD CONSTRAINT "tracked_sites_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "web_sessions" ADD CONSTRAINT "web_sessions_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "tracked_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "web_pageviews" ADD CONSTRAINT "web_pageviews_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "web_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "web_events" ADD CONSTRAINT "web_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "web_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

