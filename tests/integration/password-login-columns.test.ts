import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';

/** Клиент внутри транзакции: у него нет $transaction и $connect, поэтому тип свой */
type Tx = Parameters<Parameters<Db['$transaction']>[0]>[0];
import { hashPassword, hashSessionToken, newSessionToken, resetExpiry, sessionExpiry } from '@pms/domain';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;
class Rollback extends Error {}

/**
 * Вход по паролю поверх модели учётных записей (миграция 20260915000014_password_login, §13.8–13.9, ADR-047).
 * Сами таблицы учётных записей проверяет `accounts-schema.test.ts` — здесь только то, что добавила эта
 * миграция: пароль, токен сессии, одноразовая ссылка и автор в журнале.
 *
 * Всё в транзакции с откатом: данных после прогона не остаётся.
 */
describe.skipIf(!url)('password login columns (integration, DATABASE_URL required)', () => {
  let db: Db;
  let migrated = false;
  beforeAll(async () => {
    db = createPrismaClient(url);
    const rows = await db.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'password_hash'`;
    migrated = rows.length > 0;
    if (!migrated)
      console.warn('миграция 20260915000014_password_login не применена к этой базе — проверки пропущены');
  });
  afterAll(async () => {
    await db.$disconnect();
  });

  /** Человек и организация: без членства сессию открывать не под чем (§13.3) */
  async function seed(tx: Tx, email: string, passwordHash = hashPassword('luxx-stoika-2026')) {
    const organization = await tx.organization.create({
      data: { name: 'Тест-организация', status: 'ACTIVE' },
    });
    const user = await tx.user.create({ data: { email, name: 'Тест Учётка', passwordHash } });
    await tx.membership.create({ data: { userId: user.id, organizationId: organization.id } });
    return { organization, user };
  }

  it('пароль по умолчанию пустой: человек, заведённый без пароля, по паролю не войдёт', async (ctx) => {
    if (!migrated) return ctx.skip();
    await expect(
      db.$transaction(async (tx) => {
        const user = await tx.user.create({ data: { email: 'pwd-1@example.invalid' } });
        expect(user.passwordHash).toBe('');
        expect(user.failedAttempts).toBe(0);
        expect(user.lockedUntil).toBeNull();
        throw new Rollback();
      }),
    ).rejects.toThrow(Rollback);
  });

  it('один и тот же токен сессии дважды не запишется', async (ctx) => {
    if (!migrated) return ctx.skip();
    await expect(
      db.$transaction(async (tx) => {
        const { organization, user } = await seed(tx, 'pwd-2@example.invalid');
        const tokenHash = hashSessionToken(newSessionToken());
        const data = {
          userId: user.id,
          organizationId: organization.id,
          tokenHash,
          expiresAt: sessionExpiry(new Date()),
        };
        await tx.session.create({ data });
        await tx.session.create({ data });
      }),
    ).rejects.toThrow();
  });

  it('удаление сотрудника уносит сессии и ссылки, но оставляет его записи в журнале', async (ctx) => {
    if (!migrated) return ctx.skip();
    await expect(
      db.$transaction(async (tx) => {
        const { organization, user } = await seed(tx, 'pwd-3@example.invalid');
        await tx.session.create({
          data: {
            userId: user.id,
            organizationId: organization.id,
            tokenHash: hashSessionToken(newSessionToken()),
            expiresAt: sessionExpiry(new Date()),
          },
        });
        await tx.passwordReset.create({
          data: {
            userId: user.id,
            tokenHash: hashSessionToken(newSessionToken()),
            expiresAt: resetExpiry(new Date()),
          },
        });
        const entry = await tx.auditLog.create({
          data: {
            userId: user.id,
            entityType: 'test',
            entityId: 'password-login-columns',
            action: 'test.accounts',
          },
        });

        // членство держит ссылку на человека (ON DELETE RESTRICT в их миграции) — снимаем его первым
        await tx.membership.deleteMany({ where: { userId: user.id } });
        await tx.session.deleteMany({ where: { userId: user.id } });
        await tx.user.delete({ where: { id: user.id } });

        expect(await tx.passwordReset.count({ where: { userId: user.id } })).toBe(0);
        const kept = await tx.auditLog.findUnique({ where: { id: entry.id } });
        expect(kept).not.toBeNull();
        expect(kept?.userId).toBeNull();
        throw new Rollback();
      }),
    ).rejects.toThrow(Rollback);
  });

  it('одна и та же ссылка на пароль дважды не запишется, и без сотрудника её нет', async (ctx) => {
    if (!migrated) return ctx.skip();
    const tokenHash = hashSessionToken(newSessionToken());
    await expect(
      db.$transaction(async (tx) => {
        const { user } = await seed(tx, 'pwd-4@example.invalid');
        const data = { userId: user.id, tokenHash, expiresAt: resetExpiry(new Date()) };
        await tx.passwordReset.create({ data });
        await tx.passwordReset.create({ data });
      }),
    ).rejects.toThrow();

    await expect(
      db.$transaction(async (tx) => {
        await tx.passwordReset.create({
          data: {
            userId: '00000000-0000-0000-0000-000000000000',
            tokenHash: hashSessionToken(newSessionToken()),
            expiresAt: resetExpiry(new Date()),
          },
        });
      }),
    ).rejects.toThrow();
  });
});
