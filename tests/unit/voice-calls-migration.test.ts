import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RLS_TENANT_TABLES } from '@pms/database';

/**
 * Миграция 142 «Журнал голосовых звонков» (docs/decisions/2026-10-22-voice-stage2-storage.md, DATA_MODEL VOICE-OWNER-APPROVAL-20261022).
 * Сторож без базы: форму миграции, откат, реестр RLS и схему Prisma держит текст. Поведение в базе (RLS, CHECK, откат)
 * проверено отдельно на чистой базе, запись в docs/status/2026-10-22-voice-schema.md.
 */
const ROOT = resolve(import.meta.dirname, '../..');
const DIR = resolve(ROOT, 'packages/database/prisma/migrations/20261022000142_voice_calls');
const read = (path: string) => readFileSync(path, 'utf8');
const TABLES = ['voice_calls', 'voice_callbacks', 'voice_profiles'] as const;

describe('миграция 142 voice_calls', () => {
  it('есть migration.sql, down.sql и README', () => {
    for (const file of ['migration.sql', 'down.sql', 'README.md']) expect(existsSync(resolve(DIR, file)), file).toBe(true);
  });

  const sql = existsSync(resolve(DIR, 'migration.sql')) ? read(resolve(DIR, 'migration.sql')) : '';

  it.each(TABLES)('%s: таблица, ENABLE и FORCE RLS, политика по организации', (table) => {
    expect(sql).toContain(`CREATE TABLE "${table}"`);
    expect(sql).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
    expect(sql).toContain(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
    expect(sql).toMatch(new RegExp(`CREATE POLICY rls_tenant ON "${table}" FOR SELECT TO wetop_app USING \\("organization_id" = app_current_org\\(\\)\\)`));
  });

  it('звонок уникален по агенту и внешнему ID (повтор события не плодит строки)', () => {
    expect(sql).toMatch(/UNIQUE[^;]*"agent_id", "external_call_id"/);
  });

  it('полный телефон только в просьбах: E.164 по CHECK, в звонках маска', () => {
    expect(sql).toMatch(/"voice_callbacks_phone"[\s\S]*\^\\\+\[0-9\]\{10,15\}\$/);
    expect(sql).toMatch(/"caller_masked" VARCHAR\(12\)/);
    expect(sql).not.toMatch(/"caller_phone"/);
  });

  it('просьба закрыта только с отметкой времени, одна просьба на звонок и номер', () => {
    expect(sql).toMatch(/"status" <> 'DONE' OR "done_at" IS NOT NULL/);
    expect(sql).toMatch(/UNIQUE[^;]*"voice_call_id", "phone"/);
  });

  it('права: события пишет только служебная роль, приложение читает и закрывает просьбы', () => {
    expect(sql).toMatch(/GRANT SELECT, INSERT, UPDATE ON "voice_calls", "voice_callbacks", "voice_profiles" TO wetop_service/);
    expect(sql).toMatch(/GRANT SELECT ON "voice_calls", "voice_profiles" TO wetop_app/);
    expect(sql).toMatch(/GRANT SELECT ON "voice_callbacks" TO wetop_app/);
    expect(sql).toMatch(/GRANT UPDATE \("status", "done_at", "done_by_id"\) ON "voice_callbacks" TO wetop_app/);
    expect(sql).not.toMatch(/GRANT[^;]*INSERT[^;]*ON "voice_calls"[^;]*TO wetop_app/);
  });

  it('время событий ставит приложение: у состояний нет DEFAULT now() для received_at', () => {
    expect(sql).toMatch(/"received_at" TIMESTAMPTZ\(6\) NOT NULL,/);
  });

  it('объект, бизнес и агент одной организации проверяет триггер', () => {
    expect(sql).toContain('voice_scope_guard');
  });

  it('транзакция и search_path у функций', () => {
    expect(sql.trimStart().startsWith('--')).toBe(true);
    expect(sql).toContain('BEGIN;');
    expect(sql.trimEnd().endsWith('COMMIT;')).toBe(true);
    expect(sql).toMatch(/ALTER FUNCTION %I\.voice_scope_guard\(\) SET search_path/);
  });

  it('нет длинного тире', () => {
    expect(sql).not.toContain(String.fromCharCode(0x2014));
  });
});

describe('откат 142', () => {
  const down = existsSync(resolve(DIR, 'down.sql')) ? read(resolve(DIR, 'down.sql')) : '';
  it('отказывает, если таблицы используются, и снимает всё созданное', () => {
    expect(down).toContain('RAISE EXCEPTION');
    for (const table of TABLES) {
      expect(down).toContain(`DROP TABLE "${table}"`);
      expect(down).toMatch(new RegExp(`SELECT 1 FROM "${table}"`));
    }
    expect(down).toContain('DROP FUNCTION voice_scope_guard()');
    for (const type of ['VoiceCallState', 'VoiceCallbackStatus', 'VoiceDirection']) expect(down).toContain(`DROP TYPE "${type}"`);
  });
});

describe('схема и реестры', () => {
  const schema = read(resolve(ROOT, 'packages/database/prisma/schema.prisma'));
  it.each(['VoiceCall', 'VoiceCallback', 'VoiceProfile'])('Prisma-модель %s', (model) => {
    expect(schema).toContain(`model ${model} {`);
  });
  it.each(['VoiceCallState', 'VoiceCallbackStatus', 'VoiceDirection'])('Prisma enum %s', (e) => {
    expect(schema).toContain(`enum ${e} {`);
  });
  it.each(TABLES)('%s в реестре таблиц под RLS', (table) => {
    expect(RLS_TENANT_TABLES).toContain(table);
  });
  it('восстановление прав из дампа знает новые таблицы', () => {
    const restore = read(resolve(ROOT, 'scripts/ops/restore-mixed-domain-grants.sql'));
    for (const table of TABLES) expect(restore).toContain(table);
  });
  it('проверка RLS в integration знает новые таблицы под FORCE', () => {
    const rls = read(resolve(ROOT, 'tests/integration/rls-isolation.test.ts'));
    for (const table of TABLES) expect(rls).toContain(`'${table}'`);
  });
});
