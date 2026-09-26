-- CreateTable
CREATE TABLE "seller_agents" (
    "created_by" UUID NOT NULL,
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "scenario" VARCHAR(16) NOT NULL DEFAULT 'sales',
    "lifecycle" VARCHAR(16) NOT NULL DEFAULT 'draft',
    "profile" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "seller_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wizard_sessions" (
    "id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "ref" VARCHAR(200) NOT NULL DEFAULT '',
    "last_step" VARCHAR(24) NOT NULL DEFAULT 'intro',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "wizard_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wizard_drafts" (
    "claimed_by" UUID,
    "organization_id" UUID,
    "id" UUID NOT NULL,
    "guest_session_id" UUID NOT NULL,
    "business_name" VARCHAR(200) NOT NULL DEFAULT '',
    "niche" VARCHAR(200) NOT NULL DEFAULT '',
    "description" VARCHAR(10000) NOT NULL DEFAULT '',
    "config" JSONB NOT NULL DEFAULT '{}',
    "sources" JSONB NOT NULL DEFAULT '[]',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "generated_revision" INTEGER,
    "generated_prompt" TEXT,
    "generated_knowledge" JSONB NOT NULL DEFAULT '[]',
    "test_messages_used" INTEGER NOT NULL DEFAULT 0,
    "agent_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "wizard_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wizard_jobs" (
    "id" UUID NOT NULL,
    "draft_id" UUID NOT NULL,
    "kind" VARCHAR(16) NOT NULL,
    "revision" INTEGER NOT NULL,
    "state" VARCHAR(16) NOT NULL DEFAULT 'queued',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "retry_at" TIMESTAMPTZ(6),
    "masked_error" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "wizard_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wizard_messages" (
    "id" UUID NOT NULL,
    "draft_id" UUID NOT NULL,
    "request_id" VARCHAR(64) NOT NULL,
    "role" VARCHAR(16) NOT NULL,
    "text" VARCHAR(16000) NOT NULL,
    "state" VARCHAR(16) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wizard_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wizard_surveys" (
    "guest_session_id" UUID NOT NULL,
    "goal" VARCHAR(1000) NOT NULL DEFAULT '',
    "team_size" VARCHAR(32) NOT NULL DEFAULT '',
    "leads_per_day" VARCHAR(32) NOT NULL DEFAULT '',
    "source" VARCHAR(200) NOT NULL DEFAULT '',
    "industry" VARCHAR(200) NOT NULL DEFAULT '',

    CONSTRAINT "wizard_surveys_pkey" PRIMARY KEY ("guest_session_id")
);

-- CreateTable
CREATE TABLE "wizard_events" (
    "id" UUID NOT NULL,
    "guest_session_id" UUID NOT NULL,
    "event_type" VARCHAR(60) NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "deduplication_key" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wizard_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seller_agents_organization_id_idx" ON "seller_agents"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "wizard_sessions_token_hash_key" ON "wizard_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "wizard_sessions_expires_at_idx" ON "wizard_sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "wizard_drafts_guest_session_id_key" ON "wizard_drafts"("guest_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "wizard_drafts_agent_id_key" ON "wizard_drafts"("agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "wizard_jobs_draft_id_kind_revision_key" ON "wizard_jobs"("draft_id", "kind", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "wizard_messages_draft_id_request_id_role_key" ON "wizard_messages"("draft_id", "request_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "wizard_events_deduplication_key_key" ON "wizard_events"("deduplication_key");

-- CreateIndex
CREATE INDEX "wizard_events_guest_session_id_created_at_idx" ON "wizard_events"("guest_session_id", "created_at");

-- AddForeignKey
ALTER TABLE "seller_agents" ADD CONSTRAINT "seller_agents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_agents" ADD CONSTRAINT "seller_agents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wizard_drafts" ADD CONSTRAINT "wizard_drafts_claimed_by_fkey" FOREIGN KEY ("claimed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wizard_drafts" ADD CONSTRAINT "wizard_drafts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wizard_drafts" ADD CONSTRAINT "wizard_drafts_guest_session_id_fkey" FOREIGN KEY ("guest_session_id") REFERENCES "wizard_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wizard_drafts" ADD CONSTRAINT "wizard_drafts_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "seller_agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wizard_jobs" ADD CONSTRAINT "wizard_jobs_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "wizard_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wizard_messages" ADD CONSTRAINT "wizard_messages_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "wizard_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wizard_surveys" ADD CONSTRAINT "wizard_surveys_guest_session_id_fkey" FOREIGN KEY ("guest_session_id") REFERENCES "wizard_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wizard_events" ADD CONSTRAINT "wizard_events_guest_session_id_fkey" FOREIGN KEY ("guest_session_id") REFERENCES "wizard_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "seller_agents" ADD CONSTRAINT "seller_agents_scenario_check" CHECK (scenario IN ('sales', 'support'));
ALTER TABLE "seller_agents" ADD CONSTRAINT "seller_agents_lifecycle_check" CHECK (lifecycle IN ('draft', 'preparing', 'ready', 'error', 'archived'));
ALTER TABLE "wizard_drafts" ADD CONSTRAINT "wizard_drafts_quota_check" CHECK (test_messages_used BETWEEN 0 AND 5);
ALTER TABLE "wizard_drafts" ADD CONSTRAINT "wizard_drafts_revision_check" CHECK (revision >= 0 AND (generated_revision IS NULL OR generated_revision <= revision));
ALTER TABLE "wizard_sessions" ADD CONSTRAINT "wizard_sessions_hash_check" CHECK (token_hash ~ '^[a-f0-9]{64}$');
ALTER TABLE "wizard_sessions" ADD CONSTRAINT "wizard_sessions_expiry_check" CHECK (expires_at > created_at);
