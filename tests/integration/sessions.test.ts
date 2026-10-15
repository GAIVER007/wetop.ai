import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { hashSessionToken } from '@pms/domain';
import { newSessionToken } from '@pms/shared';
import { PrismaAccountsRepository } from '../../apps/api/src/accounts/accounts.prisma-repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
process.env.SESSION_SECRET ??= 'секрет-для-прогона';
const url = process.env.DATABASE_URL;

/**
 * Срез 13, §3 п. 3: список активных сессий и «выйти везде» на живой базе (DATA_MODEL §13.5).
 * Здесь — то, что делает база: в списке нет отозванных, протухших и чужих; отзыв всех строк
 * человека не задевает соседа. Строки свои, с суффиксом прогона; в конце удаляются.
 */
describe.skipIf(!url)('sessions repository (integration, DATABASE_URL required)', () => {
  let db: Db;
  let repo: PrismaAccountsRepository;
  const mark = randomUUID().slice(0, 8);
  const meEmail = `me-${mark}@example.test`;
  const otherEmail = `other-${mark}@example.test`;
  let me = { userId: '', organizationId: '' };
  let other = { userId: '', organizationId: '' };
  const day = 86_400_000;

  const session = (
    userId: string,
    organizationId: string,
    opts: { expiresAt?: Date; issuedAt?: Date; userAgent?: string } = {},
  ) =>
    // Сессии заводит AuthService своей таблицей; у репозитория учётных записей такого метода больше
    // нет (ADR-053, вход по коду снят) — здесь пишем строку напрямую, как это делает AuthService.
    db.session.create({
      data: {
        tokenHash: hashSessionToken(newSessionToken()),
        userId,
        organizationId,
        expiresAt: opts.expiresAt ?? new Date(Date.now() + 30 * day),
        ...(opts.issuedAt ? { issuedAt: opts.issuedAt } : {}),
        userAgent: opts.userAgent ?? null,
      },
    });

  beforeAll(async () => {
    db = createPrismaClient(url);
    repo = new PrismaAccountsRepository({ db } as unknown as PrismaService);
    const a = await repo.createAccount({
      email: meEmail,
      organizationName: `Сессии (integration ${mark})`,
      trialEndsAt: new Date(Date.now() + 7 * day),
    });
    const b = await repo.createAccount({
      email: otherEmail,
      organizationName: `Сессии-сосед (integration ${mark})`,
      trialEndsAt: new Date(Date.now() + 7 * day),
    });
    if (!a || !b) throw new Error('учётки не созданы');
    me = { userId: a.userId, organizationId: a.organizationId };
    other = { userId: b.userId, organizationId: b.organizationId };
  });

  afterAll(async () => {
    if (!db) return;
    const orgs = [me.organizationId, other.organizationId].filter(Boolean);
    await db.session.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.membership.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.user.deleteMany({ where: { email: { in: [meEmail, otherEmail] } } });
    await db.organization.deleteMany({ where: { id: { in: orgs } } });
    await db.$disconnect();
  });

  it('в списке только живые сессии этого человека, новые сверху, с агентом', async () => {
    const firstIssuedAt = new Date(Date.now() - 2000);
    const secondIssuedAt = new Date(firstIssuedAt.getTime() + 1000);
    await session(me.userId, me.organizationId, { userAgent: 'первый', issuedAt: firstIssuedAt });
    await session(me.userId, me.organizationId, { userAgent: 'второй', issuedAt: secondIssuedAt });
    await session(me.userId, me.organizationId, {
      expiresAt: new Date(Date.now() - 1000),
      userAgent: 'протух',
    });
    await session(other.userId, other.organizationId, { userAgent: 'сосед' });

    const list = await repo.sessionsForUser(me.userId, new Date());
    expect(list.map((s) => s.userAgent)).toEqual(['второй', 'первый']);
    for (const s of list) {
      expect(s.tokenHash).toHaveLength(64);
      expect(s.issuedAt).toBeInstanceOf(Date);
    }
  });

  it('«выйти везде» отзывает все строки человека, чужие живы; повтор — ноль строк', async () => {
    const revoked = await repo.revokeAllSessions(me.userId, new Date());
    expect(revoked).toBe(2);
    expect(await repo.sessionsForUser(me.userId, new Date())).toEqual([]);
    expect((await repo.sessionsForUser(other.userId, new Date())).map((s) => s.userAgent)).toEqual([
      'сосед',
    ]);
    expect(await repo.revokeAllSessions(me.userId, new Date())).toBe(0);
  });
});
