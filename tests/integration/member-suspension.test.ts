import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { hashSessionToken } from '@pms/domain';
import { PrismaAccountsRepository } from '../../apps/api/src/accounts/accounts.prisma-repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;
class Rollback extends Error {}

/**
 * Приостановка доступа (DATA_MODEL §30.2, Q-289, STAFF2.3b) на настоящей базе: статус членства, отзыв сессий организации,
 * вход закрыт, сессия приостановленного не пускает, возобновление возвращает вход; журнал организации. Всё вымышленное
 * (ADR-010) и откатывается транзакцией.
 */
describe.skipIf(!url)('приостановка доступа (integration, DATABASE_URL required)', () => {
  let db: Db;
  beforeAll(() => {
    db = createPrismaClient(url);
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  async function rolledBack(fn: (tx: Db) => Promise<void>): Promise<void> {
    await expect(
      db.$transaction(async (tx) => {
        await fn(tx as unknown as Db);
        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);
  }

  it('приостановка гасит сессии, закрывает вход и возвращается одним действием', async () => {
    await rolledBack(async (tx) => {
      const mark = randomUUID().slice(0, 8);
      const org = await tx.organization.create({
        data: { name: `Приост ${mark}` },
        select: { id: true },
      });
      const make = async (who: string, role: 'OWNER' | 'STAFF') => {
        const u = await tx.user.create({
          data: { email: `${who}-${mark}@example.invalid`, name: who },
          select: { id: true },
        });
        await tx.membership.create({ data: { userId: u.id, organizationId: org.id, role } });
        return u.id;
      };
      const owner = await make('owner', 'OWNER');
      const admin = await make('admin', 'STAFF');
      const tokenHash = hashSessionToken(`suspend-${mark}`);
      await tx.session.create({
        data: {
          tokenHash,
          userId: admin,
          organizationId: org.id,
          expiresAt: new Date(Date.now() + 3600_000),
        },
      });
      const repo = new PrismaAccountsRepository({ db: tx } as PrismaService);
      expect((await repo.sessionByTokenHash(tokenHash))?.member).toBe(true);

      // владельца приостановить нельзя: роль не из `roles`
      expect(
        await repo.setMemberSuspended({
          organizationId: org.id,
          userId: owner,
          suspended: true,
          by: owner,
          roles: ['STAFF'],
        }),
      ).toEqual({ outcome: 'role', role: 'OWNER' });

      expect(
        await repo.setMemberSuspended({
          organizationId: org.id,
          userId: admin,
          suspended: true,
          by: owner,
          roles: ['MANAGER', 'STAFF'],
        }),
      ).toEqual({ outcome: 'done', role: 'STAFF' });
      const stored = await tx.session.findUniqueOrThrow({ where: { tokenHash } });
      expect(stored.revokedAt).not.toBeNull();
      // даже неотозванная сессия приостановленного не пускает: member = false
      await tx.session.update({ where: { tokenHash }, data: { revokedAt: null } });
      expect((await repo.sessionByTokenHash(tokenHash))?.member).toBe(false);
      expect(await repo.accountByEmail(`admin-${mark}@example.invalid`)).toBeNull();
      expect((await repo.members(org.id)).find((m) => m.userId === admin)?.suspended).toBe(true);
      // членство на месте
      expect(await tx.membership.count({ where: { organizationId: org.id, userId: admin } })).toBe(
        1,
      );

      await repo.setMemberSuspended({
        organizationId: org.id,
        userId: admin,
        suspended: false,
        by: owner,
        roles: ['MANAGER', 'STAFF'],
      });
      expect((await repo.sessionByTokenHash(tokenHash))?.member).toBe(true);
      expect((await repo.accountByEmail(`admin-${mark}@example.invalid`))?.userId).toBe(admin);
      const row = await tx.membership.findUniqueOrThrow({
        where: { userId_organizationId: { userId: admin, organizationId: org.id } },
      });
      expect([row.status, row.suspendedAt, row.suspendedBy]).toEqual(['ACTIVE', null, null]);

      const journal = await tx.auditLog.findMany({
        where: { organizationId: org.id, action: { startsWith: 'membership.' } },
        orderBy: { createdAt: 'asc' },
        select: { action: true, userId: true },
      });
      expect(journal.map((j) => [j.action, j.userId])).toEqual([
        ['membership.suspended', owner],
        ['membership.resumed', owner],
      ]);
    });
  });
});
