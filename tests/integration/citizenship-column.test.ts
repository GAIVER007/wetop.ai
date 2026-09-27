import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;
class Rollback extends Error {}

/**
 * Q-117: колонка была CHAR(3) — Postgres дополнял пустую строку пробелами, и '   ' читалось программой
 * как заполненное гражданство. Код это уже нормализует, но база принимала что угодно из трёх символов.
 * Проверяем саму базу: тип переменной длины (пробелов не дописывает) и ограничение формата alpha-3.
 */
describe.skipIf(!url)('guests.citizenship column (integration, DATABASE_URL required)', () => {
  let db: Db;
  /** Пока миграция 20260913000011 не применена к этой базе, проверять нечего — тесты пропускаются */
  let migrated = false;
  /** Гость принадлежит организации (DATA_MODEL v1.13, RLS-1) — берём самую старую, как привязка объектов */
  let organizationId = '';
  beforeAll(async () => {
    db = createPrismaClient(url);
    organizationId = (await db.organization.findFirstOrThrow({ orderBy: { createdAt: 'asc' } })).id;
    const rows = await db.$queryRaw<Array<{ conname: string }>>`
      SELECT conname FROM pg_constraint WHERE conname = 'guests_citizenship_alpha3'`;
    migrated = rows.length > 0;
    if (!migrated)
      console.warn(
        'миграция 20260913000011_citizenship_alpha3 не применена к этой базе — проверки колонки пропущены',
      );
  });
  afterAll(async () => {
    await db.$disconnect();
  });

  const guest = (citizenship: string | null) => ({
    organizationId,
    firstName: 'Гость',
    lastName: 'Тест-колонка',
    citizenship,
  });

  it('код alpha-3 сохраняется как есть, без дописанных пробелов; NULL допустим', async (ctx) => {
    if (!migrated) return ctx.skip();
    await expect(
      db.$transaction(async (tx) => {
        const kaz = await tx.guest.create({ data: guest('KAZ'), select: { citizenship: true } });
        expect(kaz.citizenship).toBe('KAZ');
        const none = await tx.guest.create({ data: guest(null), select: { citizenship: true } });
        expect(none.citizenship).toBeNull();
        throw new Rollback('rollback');
      }),
    ).rejects.toBeInstanceOf(Rollback);
  }, 60_000);

  it('база отвергает пустое, пробелы, нижний регистр и короткий код', async (ctx) => {
    if (!migrated) return ctx.skip();
    for (const bad of ['', '   ', 'kaz', 'KZ', '1', 'K2Z']) {
      await expect(
        db.$transaction(async (tx) => {
          await tx.guest.create({ data: guest(bad), select: { id: true } });
          throw new Rollback('rollback');
        }),
        // ожидаем отказ базы, а не Rollback: значение вообще не должно записаться
      ).rejects.not.toBeInstanceOf(Rollback);
    }
  }, 120_000);

  it('страна выдачи документа живёт по тому же правилу', async (ctx) => {
    if (!migrated) return ctx.skip();
    await expect(
      db.$transaction(async (tx) => {
        const g = await tx.guest.create({ data: guest('KAZ'), select: { id: true } });
        await tx.guestDocument.create({
          data: {
            guestId: g.id,
            type: 'PASSPORT',
            numberEncrypted: 'test-not-a-real-document',
            issueCountry: '  ',
          },
          select: { id: true },
        });
        throw new Rollback('rollback');
      }),
    ).rejects.not.toBeInstanceOf(Rollback);
  }, 60_000);
});
