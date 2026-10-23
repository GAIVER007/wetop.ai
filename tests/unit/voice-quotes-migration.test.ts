import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RLS_TENANT_TABLES } from '@pms/database';

/**
 * Миграция 148 «Котировки голосовой брони, салон и ресторан» (DATA_MODEL VOICE-BOOKING-PROPOSAL-20261023, п. 3, утверждено
 * 23.10.2026). Сторож без базы; поведение в базе проверено на чистой базе (docs/status/2026-10-23-voice-booking-salon.md).
 */
const ROOT = resolve(import.meta.dirname, '../..');
const DIR = resolve(ROOT, 'packages/database/prisma/migrations/20261023000148_voice_booking_quotes');
const read = (path: string) => readFileSync(path, 'utf8');

describe('миграция 148 voice_booking_quotes', () => {
  it('есть migration.sql, down.sql и README', () => {
    for (const file of ['migration.sql', 'down.sql', 'README.md']) expect(existsSync(resolve(DIR, file)), file).toBe(true);
  });

  const sql = existsSync(resolve(DIR, 'migration.sql')) ? read(resolve(DIR, 'migration.sql')) : '';

  it('таблица, ENABLE и FORCE RLS, политика по организации, табличный реестр RLS', () => {
    expect(sql).toContain('CREATE TABLE "voice_booking_quotes"');
    expect(sql).toContain('ALTER TABLE "voice_booking_quotes" ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE "voice_booking_quotes" FORCE ROW LEVEL SECURITY');
    expect(sql).toMatch(/CREATE POLICY rls_tenant ON "voice_booking_quotes" FOR SELECT TO wetop_app USING \("organization_id" = app_current_org\(\)\)/);
    expect(RLS_TENANT_TABLES).toContain('voice_booking_quotes');
  });

  it('вид, состояние и связь с результатом проверяет база', () => {
    expect(sql).toMatch(/"kind" IN \('APPOINTMENT', 'TABLE'\)/);
    expect(sql).toMatch(/"state" IN \('QUOTED', 'CONFIRMED', 'REJECTED', 'EXPIRED'\)/);
    expect(sql).toMatch(/\("state" = 'CONFIRMED'\) = \("result_id" IS NOT NULL\)/);
  });

  it('повтор той же котировки звонка не плодит строки, один результат у одной котировки', () => {
    expect(sql).toMatch(/UNIQUE[^;]*"agent_id", "call_ref", "request_hash"/);
    expect(sql).toMatch(/UNIQUE INDEX[^;]*"result_id"[^;]*WHERE "result_id" IS NOT NULL/);
  });

  it('звонок хранится текстом, а не внешним ключом: события звонка приходят очередью и могут опоздать', () => {
    expect(sql).toMatch(/"call_ref" VARCHAR\(64\) NOT NULL/);
    expect(sql).not.toMatch(/REFERENCES "voice_calls"/);
  });

  it('права: пишет служебная роль, приложение только читает', () => {
    expect(sql).toMatch(/GRANT SELECT, INSERT, UPDATE ON "voice_booking_quotes" TO wetop_service/);
    expect(sql).toMatch(/GRANT SELECT ON "voice_booking_quotes" TO wetop_app/);
    expect(sql).not.toMatch(/GRANT[^;]*INSERT[^;]*"voice_booking_quotes"[^;]*TO wetop_app/);
  });

  it('откат только пока таблица пуста; схема Prisma знает модель', () => {
    const down = existsSync(resolve(DIR, 'down.sql')) ? read(resolve(DIR, 'down.sql')) : '';
    expect(down).toMatch(/DROP TABLE "voice_booking_quotes"/);
    expect(down).toMatch(/RAISE EXCEPTION/);
    expect(read(resolve(ROOT, 'packages/database/prisma/schema.prisma'))).toContain('model VoiceBookingQuote');
  });
});
