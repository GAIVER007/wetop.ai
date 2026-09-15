import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { hashPassword, hashSessionToken, newSessionToken, sessionExpiry } from '@pms/domain';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;
class Rollback extends Error {}

/**
 * Учётные записи (DATA_MODEL §13 шаг 1, миграция 20260915000013_accounts). Проверяем саму базу, а не код:
 * почта уникальна и лежит в нижнем регистре, действующий сотрудник без пароля невозможен, токен сессии
 * уникален, удаление сотрудника уносит его сессии и оставляет его записи в журнале.
 *
 * Все проверки в транзакции с откатом: данных после прогона не остаётся.
 */
describe.skipIf(!url)('accounts tables (integration, DATABASE_URL required)', () => {
  let db: Db;
  let migrated = false;
  beforeAll(async () => {
    db = createPrismaClient(url);
    const rows = await db.$queryRaw<Array<{ conname: string }>>`
      SELECT conname FROM pg_constraint WHERE conname = 'users_email_shape'`;
    migrated = rows.length > 0;
    if (!migrated)
      console.warn('миграция 20260915000013_accounts не применена к этой базе — проверки пропущены');
  });
  afterAll(async () => {
    await db.$disconnect();
  });

  const user = (email: string, over: Record<string, unknown> = {}) => ({
    email,
    passwordHash: hashPassword('luxx-stoika-2026'),
    fullName: 'Тест Учётка',
    status: 'ACTIVE' as const,
    ...over,
  });

  it('почта уникальна', async (ctx) => {
    if (!migrated) return ctx.skip();
    await expect(
      db.$transaction(async (tx) => {
        await tx.user.create({ data: user('kolonka-1@example.invalid') });
        await tx.user.create({ data: user('kolonka-1@example.invalid') });
      }),
    ).rejects.toThrow();
  });

  it('база сама отвергает почту в верхнем регистре и не-почту', async (ctx) => {
    if (!migrated) return ctx.skip();
    for (const email of ['Kolonka-2@Example.invalid', 'kolonka-3', 'коло нка@example.invalid']) {
      await expect(
        db.$transaction(async (tx) => {
          await tx.user.create({ data: user(email) });
        }),
      ).rejects.toThrow();
    }
  });

  it('действующий сотрудник без пароля невозможен, приглашённый — допустим', async (ctx) => {
    if (!migrated) return ctx.skip();
    await expect(
      db.$transaction(async (tx) => {
        await tx.user.create({ data: user('kolonka-4@example.invalid', { passwordHash: '' }) });
      }),
    ).rejects.toThrow();

    await expect(
      db.$transaction(async (tx) => {
        await tx.user.create({
          data: user('kolonka-5@example.invalid', { passwordHash: '', status: 'INVITED' }),
        });
        throw new Rollback();
      }),
    ).rejects.toThrow(Rollback);
  });

  it('один и тот же токен сессии дважды не запишется', async (ctx) => {
    if (!migrated) return ctx.skip();
    await expect(
      db.$transaction(async (tx) => {
        const owner = await tx.user.create({ data: user('kolonka-6@example.invalid') });
        const tokenHash = hashSessionToken(newSessionToken());
        const expiresAt = sessionExpiry(new Date());
        await tx.session.create({ data: { userId: owner.id, tokenHash, expiresAt } });
        await tx.session.create({ data: { userId: owner.id, tokenHash, expiresAt } });
      }),
    ).rejects.toThrow();
  });

  it('удаление сотрудника уносит сессии, но оставляет его записи в журнале', async (ctx) => {
    if (!migrated) return ctx.skip();
    await expect(
      db.$transaction(async (tx) => {
        const owner = await tx.user.create({ data: user('kolonka-7@example.invalid') });
        await tx.session.create({
          data: {
            userId: owner.id,
            tokenHash: hashSessionToken(newSessionToken()),
            expiresAt: sessionExpiry(new Date()),
          },
        });
        const entry = await tx.auditLog.create({
          data: {
            userId: owner.id,
            entityType: 'test',
            entityId: 'accounts-columns',
            action: 'test.accounts',
          },
        });

        await tx.user.delete({ where: { id: owner.id } });

        expect(await tx.session.count({ where: { userId: owner.id } })).toBe(0);
        const kept = await tx.auditLog.findUnique({ where: { id: entry.id } });
        expect(kept).not.toBeNull();
        expect(kept?.userId).toBeNull();
        throw new Rollback();
      }),
    ).rejects.toThrow(Rollback);
  });

  it('сессия без сотрудника не записывается', async (ctx) => {
    if (!migrated) return ctx.skip();
    await expect(
      db.$transaction(async (tx) => {
        await tx.session.create({
          data: {
            userId: '00000000-0000-0000-0000-000000000000',
            tokenHash: hashSessionToken(newSessionToken()),
            expiresAt: sessionExpiry(new Date()),
          },
        });
      }),
    ).rejects.toThrow();
  });
});
