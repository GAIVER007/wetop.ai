-- Версии инструкции ИИ-продавца (DATA_MODEL §33): история правок окна «Инструкция», возврат к прежней версии.
-- Только добавляет таблицу; существующие данные не меняются.
CREATE TABLE "seller_prompt_versions" (
  "id"              UUID         NOT NULL,
  "agent_id"        UUID         NOT NULL,
  "organization_id" UUID         NOT NULL,
  "text"            VARCHAR(20000) NOT NULL,
  "created_by"      UUID,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "seller_prompt_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "seller_prompt_versions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "seller_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "seller_prompt_versions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "seller_prompt_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "seller_prompt_versions_text_not_empty" CHECK (length(btrim("text")) > 0)
);
CREATE INDEX "seller_prompt_versions_agent_created_idx" ON "seller_prompt_versions" ("agent_id", "created_at" DESC);

ALTER TABLE "seller_prompt_versions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "seller_prompt_versions" FOR ALL TO wetop_app
  USING ("organization_id" = app_current_org()) WITH CHECK ("organization_id" = app_current_org());
