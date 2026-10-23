import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Миграция 151 «Хэш телефона голосовой брони» (DATA_MODEL VOICE-PHONE-LIMIT-OWNER-APPROVAL-20261023). Сторож без базы;
 * поведение в базе проверено на чистой базе (docs/status/2026-10-23-voice-phone-limit.md).
 */
const ROOT = resolve(import.meta.dirname, '../..');
const DIR = resolve(ROOT, 'packages/database/prisma/migrations/20261023000151_voice_phone_limit');
const read = (path: string) => readFileSync(path, 'utf8');

describe('миграция 151 voice_phone_limit', () => {
  it('есть migration.sql, down.sql и README', () => {
    for (const file of ['migration.sql', 'down.sql', 'README.md']) expect(existsSync(resolve(DIR, file)), file).toBe(true);
  });

  const sql = existsSync(resolve(DIR, 'migration.sql')) ? read(resolve(DIR, 'migration.sql')) : '';

  it.each(['seller_booking_intents', 'voice_booking_quotes'])('%s: поле хэша, CHECK «хэш только у подтверждённой строки», частичный индекс', (table) => {
    expect(sql).toMatch(new RegExp(`ALTER TABLE "${table}"[\\s\\S]*?ADD COLUMN "guest_phone_hash" CHAR\\(64\\)`));
    expect(sql).toMatch(new RegExp(`"${table}_phone_hash_confirmed" CHECK \\("guest_phone_hash" IS NULL OR "state" = 'CONFIRMED'\\)`));
    expect(sql).toMatch(new RegExp(`CREATE INDEX "${table}_phone_hash_idx" ON "${table}" \\("agent_id", "guest_phone_hash", "updated_at"\\) WHERE "guest_phone_hash" IS NOT NULL`));
  });

  it('хэш шестнадцатеричный, не телефон', () => {
    expect(sql).toMatch(/"guest_phone_hash" ~ '\^\[0-9a-f\]\{64\}\$'/);
    expect(sql).not.toMatch(/phone\s+VARCHAR/i);
  });

  it('откат снимает индексы, проверки и поля', () => {
    const down = existsSync(resolve(DIR, 'down.sql')) ? read(resolve(DIR, 'down.sql')) : '';
    expect(down).toMatch(/DROP COLUMN "guest_phone_hash"/);
    expect(down).toMatch(/DROP INDEX "seller_booking_intents_phone_hash_idx"/);
  });

  it('схема Prisma знает поле у обеих моделей', () => {
    const schema = read(resolve(ROOT, 'packages/database/prisma/schema.prisma'));
    for (const model of ['SellerBookingIntent', 'VoiceBookingQuote']) {
      const body = new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`).exec(schema)?.[1] ?? '';
      expect(body, model).toContain('guestPhoneHash');
    }
  });
});
