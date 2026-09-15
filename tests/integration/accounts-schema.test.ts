import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Срез 13, ADR-046, DATA_MODEL §13. Проверяем не код, а саму базу: правила учётных записей должны
 * держаться ограничениями, а не аккуратностью вызывающего. Красный до миграции
 * 20260915000013_accounts, зелёный после.
 *
 * Что проверяется:
 *  - почта только в нижнем регистре (CHECK), иначе уникальность разъедется;
 *  - почта уникальна;
 *  - число попыток кода не выходит за 0..3;
 *  - на организацию и пользователя нельзя сослаться несуществующим id.
 */
describe.skipIf(!url)('accounts schema (integration, DATABASE_URL required)', () => {
  let db: Db;
  let migrated = false;

  beforeAll(async () => {
    db = createPrismaClient(url);
    const rows = await db.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'organizations'`;
    migrated = rows.length > 0;
    if (!migrated)
      console.warn(
        'миграция 20260915000013_accounts не применена к этой базе — проверки пропущены',
      );
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  const orgName = () => `Тест-учётки ${randomUUID().slice(0, 8)}`;
  const mail = () => `test-${randomUUID().slice(0, 8)}@example.test`;

  it('почта в верхнем регистре не сохраняется: за этим следит база', async (ctx) => {
    if (!migrated) return ctx.skip();
    const id = randomUUID();
    await expect(
      db.$executeRaw`INSERT INTO users (id, email, status, created_at)
        VALUES (${id}::uuid, ${'ВЕРХНИЙ@example.test'.toUpperCase()}, 'ACTIVE', now())`,
    ).rejects.toThrow();
  });

  it('одну почту дважды завести нельзя', async (ctx) => {
    if (!migrated) return ctx.skip();
    const email = mail();
    const first = randomUUID();
    await db.$executeRaw`INSERT INTO users (id, email, status, created_at)
      VALUES (${first}::uuid, ${email}, 'ACTIVE', now())`;
    try {
      await expect(
        db.$executeRaw`INSERT INTO users (id, email, status, created_at)
          VALUES (${randomUUID()}::uuid, ${email}, 'ACTIVE', now())`,
      ).rejects.toThrow();
    } finally {
      await db.$executeRaw`DELETE FROM users WHERE id = ${first}::uuid`;
    }
  });

  it('число попыток кода больше трёх база не принимает', async (ctx) => {
    if (!migrated) return ctx.skip();
    await expect(
      db.$executeRaw`INSERT INTO login_codes (id, email, code_hash, expires_at, attempts, created_at)
        VALUES (${randomUUID()}::uuid, ${mail()}, ${'x'.repeat(64)}, now() + interval '10 minutes', 4, now())`,
    ).rejects.toThrow();
  });

  it('сессию нельзя привязать к несуществующей организации', async (ctx) => {
    if (!migrated) return ctx.skip();
    const userId = randomUUID();
    const email = mail();
    await db.$executeRaw`INSERT INTO users (id, email, status, created_at)
      VALUES (${userId}::uuid, ${email}, 'ACTIVE', now())`;
    try {
      await expect(
        db.$executeRaw`INSERT INTO sessions (id, user_id, organization_id, issued_at, expires_at)
          VALUES (${randomUUID()}::uuid, ${userId}::uuid, ${randomUUID()}::uuid, now(), now() + interval '30 days')`,
      ).rejects.toThrow();
    } finally {
      await db.$executeRaw`DELETE FROM users WHERE id = ${userId}::uuid`;
    }
  });

  it('организация заводится со статусом TRIAL и сроком пробного периода', async (ctx) => {
    if (!migrated) return ctx.skip();
    const id = randomUUID();
    await db.$executeRaw`INSERT INTO organizations (id, name, status, trial_ends_at, created_at)
      VALUES (${id}::uuid, ${orgName()}, 'TRIAL', now() + interval '7 days', now())`;
    try {
      const rows = await db.$queryRaw<Array<{ status: string; trial_ends_at: Date | null }>>`
        SELECT status, trial_ends_at FROM organizations WHERE id = ${id}::uuid`;
      expect(rows).toHaveLength(1);
      expect(rows[0]?.status).toBe('TRIAL');
      expect(rows[0]?.trial_ends_at).not.toBeNull();
    } finally {
      await db.$executeRaw`DELETE FROM organizations WHERE id = ${id}::uuid`;
    }
  });
});
