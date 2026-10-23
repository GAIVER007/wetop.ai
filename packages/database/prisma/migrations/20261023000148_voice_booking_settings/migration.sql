-- 148 Настройка голосовой брони из стойки (срез 4, DATA_MODEL VOICE-BOOKING-OWNER-APPROVAL-20261023). Только права и политики.
-- Приложение (роль человека) меняет у профиля голоса своей организации только выключатель и лимит за звонок; строку профиля
-- может создать, если её ещё нет. Голос, номер перевода, «ожидает подтверждения» и ревизию по-прежнему пишет служебная роль.
-- Согласие организации, бизнеса и агента проверяет триггер voice_scope_guard (миграция 145).
BEGIN;

GRANT INSERT ("agent_id", "organization_id", "business_id", "booking_enabled", "booking_max_per_call") ON "voice_profiles" TO wetop_app;
GRANT UPDATE ("booking_enabled", "booking_max_per_call", "updated_at") ON "voice_profiles" TO wetop_app;

CREATE POLICY rls_tenant_insert ON "voice_profiles" FOR INSERT TO wetop_app WITH CHECK ("organization_id" = app_current_org());
CREATE POLICY rls_tenant_update ON "voice_profiles" FOR UPDATE TO wetop_app
  USING ("organization_id" = app_current_org()) WITH CHECK ("organization_id" = app_current_org());

COMMIT;
