import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { PrismaAccountsRepository } from '../../apps/api/src/accounts/accounts.prisma-repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;
class Rollback extends Error {}

/**
 * Область доступа на настоящей базе (DATA_MODEL §31.1, §31.3, STAFF2.3b): замена назначений одной транзакцией,
 * роль членства по старшей назначенной, очистка, отказ по роли цели, журнал; приглашение с областью, именем и телефоном
 * переносит всё при принятии, а архивный филиал по дороге отбрасывается. Всё вымышленное (ADR-010), транзакция откатывается.
 */
describe.skipIf(!url)('назначения области доступа (integration, DATABASE_URL required)', () => {
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

  async function world(tx: Db) {
    const mark = randomUUID().slice(0, 8);
    const org = await tx.organization.create({
      data: { name: `Область ${mark}` },
      select: { id: true },
    });
    const user = async (who: string, role: 'OWNER' | 'STAFF') => {
      const u = await tx.user.create({
        data: { email: `${who}-${mark}@example.invalid`, name: who },
        select: { id: true },
      });
      await tx.membership.create({ data: { userId: u.id, organizationId: org.id, role } });
      return u.id;
    };
    const owner = await user('owner', 'OWNER');
    const admin = await user('admin', 'STAFF');
    const biz = await tx.business.create({
      data: { organizationId: org.id, name: 'Гостиница', vertical: 'HOSPITALITY' },
      select: { id: true },
    });
    const loc = (name: string) =>
      tx.location.create({
        data: { businessId: biz.id, name, timezone: 'Asia/Almaty', currency: 'KZT' },
        select: { id: true },
      });
    const l1 = await loc('Филиал 1');
    const l2 = await loc('Филиал 2');
    const repo = new PrismaAccountsRepository({ db: tx } as PrismaService);
    return { mark, org: org.id, owner, admin, biz: biz.id, l1: l1.id, l2: l2.id, repo };
  }

  it('замена назначений: видны в списке, роль членства старшая, очистка возвращает организацию, журнал', async () => {
    await rolledBack(async (tx) => {
      const w = await world(tx);
      const roles = ['MANAGER', 'STAFF'] as const;
      expect(
        await w.repo.replaceMemberScopes({
          organizationId: w.org,
          userId: w.admin,
          assignments: [
            { role: 'MANAGER', businessId: w.biz, locationId: w.l1 },
            { role: 'STAFF', businessId: w.biz, locationId: w.l2 },
          ],
          by: w.owner,
          roles,
        }),
      ).toEqual({ outcome: 'done', role: 'STAFF' });
      const row = (await w.repo.members(w.org)).find((m) => m.userId === w.admin)!;
      expect(row.role).toBe('MANAGER');
      expect(row.scopes).toEqual([
        { role: 'MANAGER', businessId: w.biz, locationId: w.l1 },
        { role: 'STAFF', businessId: w.biz, locationId: w.l2 },
      ]);
      // владельцу область не назначают: роль цели не из `roles`
      expect(
        await w.repo.replaceMemberScopes({
          organizationId: w.org,
          userId: w.owner,
          assignments: [],
          by: w.owner,
          roles,
        }),
      ).toEqual({ outcome: 'role', role: 'OWNER' });
      // замена, а не добавление
      await w.repo.replaceMemberScopes({
        organizationId: w.org,
        userId: w.admin,
        assignments: [{ role: 'STAFF', businessId: w.biz, locationId: null }],
        by: w.owner,
        roles,
      });
      expect((await w.repo.members(w.org)).find((m) => m.userId === w.admin)!.scopes).toEqual([
        { role: 'STAFF', businessId: w.biz, locationId: null },
      ]);
      await w.repo.replaceMemberScopes({
        organizationId: w.org,
        userId: w.admin,
        assignments: [],
        by: w.owner,
        roles,
      });
      expect((await w.repo.members(w.org)).find((m) => m.userId === w.admin)!.scopes).toEqual([]);
      const journal = await tx.auditLog.findMany({
        where: { organizationId: w.org, action: 'membership.scope.updated' },
        select: { userId: true },
      });
      expect(journal).toHaveLength(3);
      expect(await w.repo.organizationStructure(w.org)).toEqual({
        businesses: [
          {
            id: w.biz,
            name: 'Гостиница',
            vertical: 'HOSPITALITY',
            locations: [
              { id: w.l1, name: 'Филиал 1' },
              { id: w.l2, name: 'Филиал 2' },
            ],
          },
        ],
      });
    });
  });

  it('приглашение с областью, именем и телефоном: принятие переносит всё, архивный филиал отбрасывается', async () => {
    await rolledBack(async (tx) => {
      const w = await world(tx);
      await tx.location.update({ where: { id: w.l2 }, data: { status: 'ARCHIVED' } });
      const email = `new-${w.mark}@example.invalid`;
      const invite = await w.repo.createInvite({
        organizationId: w.org,
        email,
        tokenHash: randomUUID().replaceAll('-', '').padEnd(64, '0'),
        expiresAt: new Date(Date.now() + 3600_000),
        createdBy: w.owner,
        role: 'STAFF',
        firstName: 'Айгерим',
        lastName: 'Тестова',
        phone: '+77010001122',
        position: 'Старший администратор',
        scopes: [
          { role: 'STAFF', businessId: w.biz, locationId: w.l1 },
          { role: 'STAFF', businessId: w.biz, locationId: w.l2 },
        ],
      });
      expect(invite.scopes).toHaveLength(2);
      const done = await w.repo.acceptInvite({
        id: invite.id,
        now: new Date(),
        passwordTokenHash: randomUUID().replaceAll('-', '').padEnd(64, '0'),
        passwordExpiresAt: new Date(Date.now() + 3600_000),
      });
      expect(done).not.toBeNull();
      const joined = (await w.repo.members(w.org)).find((m) => m.email === email)!;
      expect(joined).toMatchObject({
        name: 'Айгерим Тестова',
        phone: '+77010001122',
        position: 'Старший администратор',
        role: 'STAFF',
      });
      // архивный филиал отброшен, живой остался
      expect(joined.scopes).toEqual([{ role: 'STAFF', businessId: w.biz, locationId: w.l1 }]);
    });
  });

  it('приглашение без области работает на всю организацию, как раньше', async () => {
    await rolledBack(async (tx) => {
      const w = await world(tx);
      const email = `plain-${w.mark}@example.invalid`;
      const invite = await w.repo.createInvite({
        organizationId: w.org,
        email,
        tokenHash: randomUUID().replaceAll('-', '').padEnd(64, '0'),
        expiresAt: new Date(Date.now() + 3600_000),
        createdBy: w.owner,
        role: 'STAFF',
      });
      await w.repo.acceptInvite({
        id: invite.id,
        now: new Date(),
        passwordTokenHash: randomUUID().replaceAll('-', '').padEnd(64, '0'),
        passwordExpiresAt: new Date(Date.now() + 3600_000),
      });
      const joined = (await w.repo.members(w.org)).find((m) => m.email === email)!;
      expect(joined.scopes).toEqual([]);
      expect(joined.name).toBeNull();
    });
  });
});
