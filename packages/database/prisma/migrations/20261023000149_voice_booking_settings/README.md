# 149 voice_booking_settings

Права и политики для настройки голосовой брони из стойки (срез 4 плана `plans/voice-booking-slices-4-5-2026-10-23.md`).

- Приложению: `INSERT` (agent_id, organization_id, business_id, booking_enabled, booking_max_per_call) и `UPDATE` (booking_enabled, booking_max_per_call, updated_at) на `voice_profiles`.
- Политики `rls_tenant_insert` и `rls_tenant_update`: только строки своей организации. Триггер 145 сверяет организацию, бизнес и агента.
- Остальные поля профиля (голос, перевод, `booking_needs_approval`, ревизия) пишет служебная роль, как раньше.

Порядок: backup, `scripts/ops/check-voice-schema.sh`, откат `down.sql` (данные не меняются). Применяет владелец.
