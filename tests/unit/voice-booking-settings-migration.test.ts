import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Миграция 149 «Настройка голосовой брони из стойки» (DATA_MODEL VOICE-BOOKING-OWNER-APPROVAL-20261023, срез 4; README миграции 147:
 * «право приложения на правку выключателя выдаст срез 4»). Сторож без базы; поведение под ролью приложения проверено на чистой базе.
 */
const ROOT = resolve(import.meta.dirname, '../..');
const DIR = resolve(ROOT, 'packages/database/prisma/migrations/20261023000149_voice_booking_settings');
const read = (path: string) => readFileSync(path, 'utf8');

describe('миграция 149 voice_booking_settings', () => {
  it('есть migration.sql, down.sql и README', () => {
    for (const file of ['migration.sql', 'down.sql', 'README.md']) expect(existsSync(resolve(DIR, file)), file).toBe(true);
  });

  const sql = existsSync(resolve(DIR, 'migration.sql')) ? read(resolve(DIR, 'migration.sql')) : '';

  it('приложению даны только столбцы выключателя и лимита (не профиль голоса и не служебные поля)', () => {
    expect(sql).toMatch(/GRANT INSERT \("agent_id", "organization_id", "business_id", "booking_enabled", "booking_max_per_call"\) ON "voice_profiles" TO wetop_app/);
    expect(sql).toMatch(/GRANT UPDATE \("booking_enabled", "booking_max_per_call", "updated_at"\) ON "voice_profiles" TO wetop_app/);
    expect(sql).not.toMatch(/GRANT UPDATE \([^)]*"handoff_phone"/);
    expect(sql).not.toMatch(/GRANT UPDATE \([^)]*"booking_needs_approval"/);
  });

  it('политики вставки и правки только своей организации', () => {
    expect(sql).toMatch(/CREATE POLICY rls_tenant_insert ON "voice_profiles" FOR INSERT TO wetop_app WITH CHECK \("organization_id" = app_current_org\(\)\)/);
    expect(sql).toMatch(/CREATE POLICY rls_tenant_update ON "voice_profiles" FOR UPDATE TO wetop_app\s+USING \("organization_id" = app_current_org\(\)\) WITH CHECK \("organization_id" = app_current_org\(\)\)/);
  });

  it('откат снимает права и политики', () => {
    const down = existsSync(resolve(DIR, 'down.sql')) ? read(resolve(DIR, 'down.sql')) : '';
    expect(down).toMatch(/DROP POLICY rls_tenant_update ON "voice_profiles"/);
    expect(down).toMatch(/DROP POLICY rls_tenant_insert ON "voice_profiles"/);
    expect(down).toMatch(/REVOKE INSERT, UPDATE ON "voice_profiles" FROM wetop_app/);
  });

  it('сценарий восстановления прав знает про эти права', () => {
    const restore = read(resolve(ROOT, 'scripts/ops/restore-mixed-domain-grants.sql'));
    expect(restore).toMatch(/GRANT UPDATE \(booking_enabled, booking_max_per_call, updated_at\) ON voice_profiles TO wetop_app/);
  });
});
