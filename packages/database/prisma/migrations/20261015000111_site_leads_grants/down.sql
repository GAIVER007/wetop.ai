-- Откат 20261015000111_site_leads_grants: права по умолчанию миграции 026 (SELECT, INSERT, UPDATE, DELETE)
GRANT SELECT, INSERT, UPDATE, DELETE ON "site_leads" TO wetop_app, wetop_service;
