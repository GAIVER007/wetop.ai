-- Откат SITE-5 (20261015000110_site_leads). Заявки с сайта теряются. Перед откатом снять копию (`docs/deploy.md`).
DROP POLICY IF EXISTS rls_tenant ON "site_leads";
DROP TRIGGER IF EXISTS site_lead_guard ON "site_leads";
DROP FUNCTION IF EXISTS site_lead_guard();
DROP TABLE IF EXISTS "site_leads";
DROP TYPE IF EXISTS "SiteLeadStatus";
DROP TYPE IF EXISTS "SiteLeadKind";
