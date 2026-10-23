import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Миграция 146 «Голосовая бронь, гостиница» (DATA_MODEL VOICE-BOOKING-OWNER-APPROVAL-20261023). Сторож без базы:
 * форму миграции, откат и схему Prisma держит текст; поведение в базе проверено на чистой базе
 * (docs/status/2026-10-23-voice-booking-hotel.md).
 */
const ROOT = resolve(import.meta.dirname, '../..');
const DIR = resolve(ROOT, 'packages/database/prisma/migrations/20261023000146_voice_booking');
const read = (path: string) => readFileSync(path, 'utf8');

describe('миграция 146 voice_booking', () => {
  it('есть migration.sql, down.sql и README', () => {
    for (const file of ['migration.sql', 'down.sql', 'README.md']) expect(existsSync(resolve(DIR, file)), file).toBe(true);
  });

  const sql = existsSync(resolve(DIR, 'migration.sql')) ? read(resolve(DIR, 'migration.sql')) : '';

  it.each(['"ReservationSource"', '"RestaurantReservationSource"', '"AppointmentSource"'])(
    'источник брони «голос» добавлен в %s',
    (type) => {
      expect(sql).toContain(`ALTER TYPE ${type} ADD VALUE IF NOT EXISTS 'VOICE'`);
    },
  );

  it('четыре поля выключателя и лимитов в voice_profiles с умолчаниями из решения владельца', () => {
    expect(sql).toMatch(/"booking_enabled" BOOLEAN NOT NULL DEFAULT false/);
    expect(sql).toMatch(/"booking_needs_approval" BOOLEAN NOT NULL DEFAULT true/);
    expect(sql).toMatch(/"booking_max_per_call" SMALLINT NOT NULL DEFAULT 3/);
    expect(sql).toMatch(/"booking_max_per_phone_day" SMALLINT NOT NULL DEFAULT 5/);
    expect(sql).toMatch(/"booking_max_per_call" BETWEEN 1 AND 20/);
    expect(sql).toMatch(/"booking_max_per_phone_day" BETWEEN 1 AND 20/);
  });

  it('канал голоса разрешён у котировок гостиницы, прежние каналы остались', () => {
    expect(sql).toMatch(/DROP CONSTRAINT "seller_booking_intents_channel"/);
    expect(sql).toMatch(/CHECK \("channel" IN \('whatsapp', 'widget', 'voice'\)\)/);
  });

  it('новой таблицы нет: котировки стола и записи идут со срезами ресторана и салона', () => {
    expect(sql).not.toMatch(/CREATE TABLE/);
  });

  it('откат возвращает канал и поля, пока голосовыми бронями не пользовались', () => {
    const down = existsSync(resolve(DIR, 'down.sql')) ? read(resolve(DIR, 'down.sql')) : '';
    expect(down).toMatch(/channel" = 'voice'/);
    expect(down).toMatch(/DROP COLUMN "booking_enabled"/);
    expect(down).toMatch(/CHECK \("channel" IN \('whatsapp', 'widget'\)\)/);
  });

  it('схема Prisma знает значение VOICE, поля профиля и канал голоса', () => {
    const schema = read(resolve(ROOT, 'packages/database/prisma/schema.prisma'));
    for (const name of ['ReservationSource', 'RestaurantReservationSource', 'AppointmentSource']) {
      const body = new RegExp(`enum ${name} \\{([^}]*)\\}`).exec(schema)?.[1] ?? '';
      expect(body, name).toMatch(/\bVOICE\b/);
    }
    const profile = /model VoiceProfile \{([\s\S]*?)\n\}/.exec(schema)?.[1] ?? '';
    for (const f of ['bookingEnabled', 'bookingNeedsApproval', 'bookingMaxPerCall', 'bookingMaxPerPhoneDay'])
      expect(profile, f).toContain(f);
  });
});
