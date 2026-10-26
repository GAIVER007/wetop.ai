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
 * Доступ при добавлении сотрудника (решение владельца 20.10.2026, docs/decisions/2026-10-20-staff-access-levels.md):
 * приглашение «Личный кабинет» с сотрудником и филиалом. После принятия человек входит с ролью EMPLOYEE только в этот
 * филиал, а `employees.user_id` ставится сам, без ручной привязки. Всё вымышленное, транзакция откатывается.
 */
describe.skipIf(!url)('уровни доступа сотрудника (integration, DATABASE_URL required)', () => {
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
    const org = await tx.organization.create({ data: { name: `Доступ ${mark}` }, select: { id: true } });
    const owner = await tx.user.create({
      data: { email: `owner-${mark}@example.invalid`, name: 'Владелец' },
      select: { id: true },
    });
    await tx.membership.create({ data: { userId: owner.id, organizationId: org.id, role: 'OWNER' } });
    const biz = await tx.business.create({
      data: { organizationId: org.id, name: 'Салон', vertical: 'BEAUTY' },
      select: { id: true },
    });
    const loc = await tx.location.create({
      data: { businessId: biz.id, name: 'Центр', timezone: 'Asia/Almaty', currency: 'KZT' },
      select: { id: true },
    });
    const employee = await tx.employee.create({
      data: { businessId: biz.id, name: 'Анна Мастер', personnelKind: 'SPECIALIST' },
      select: { id: true },
    });
    const repo = new PrismaAccountsRepository({ db: tx } as PrismaService);
    return { mark, org: org.id, owner: owner.id, biz: biz.id, loc: loc.id, employee: employee.id, repo };
  }

  it('«Личный кабинет»: роль EMPLOYEE в одном филиале и аккаунт сам привязан к сотруднику', async () => {
    await rolledBack(async (tx) => {
      const w = await world(tx);
      const email = `anna-${w.mark}@example.invalid`;
      const invite = await w.repo.createInvite({
        organizationId: w.org,
        email,
        tokenHash: randomUUID().replaceAll('-', '').padEnd(64, '0'),
        expiresAt: new Date(Date.now() + 3600_000),
        createdBy: w.owner,
        role: 'EMPLOYEE',
        firstName: 'Анна',
        lastName: 'Мастер',
        scopes: [{ role: 'EMPLOYEE', businessId: w.biz, locationId: w.loc }],
        employeeId: w.employee,
      });
      expect(invite.employeeId).toBe(w.employee);
      const done = await w.repo.acceptInvite({
        id: invite.id,
        now: new Date(),
        passwordTokenHash: randomUUID().replaceAll('-', '').padEnd(64, '0'),
        passwordExpiresAt: new Date(Date.now() + 3600_000),
      });
      expect(done).not.toBeNull();
      const joined = (await w.repo.members(w.org)).find((m) => m.email === email)!;
      expect(joined.role).toBe('EMPLOYEE');
      expect(joined.scopes).toEqual([{ role: 'EMPLOYEE', businessId: w.biz, locationId: w.loc }]);
      const linked = await tx.employee.findUniqueOrThrow({ where: { id: w.employee }, select: { userId: true } });
      expect(linked.userId).toBe(joined.userId);
      const audit = await tx.auditLog.findFirst({
        where: { organizationId: w.org, action: 'employee.account_linked' },
        select: { entityId: true },
      });
      expect(audit?.entityId).toBe(w.employee);
    });
  });

  it('сотрудник уже привязан к другому аккаунту: приглашение принимается, чужую привязку не перезаписывает', async () => {
    await rolledBack(async (tx) => {
      const w = await world(tx);
      const other = await tx.user.create({
        data: { email: `other-${w.mark}@example.invalid` },
        select: { id: true },
      });
      await tx.employee.update({ where: { id: w.employee }, data: { userId: other.id } });
      const invite = await w.repo.createInvite({
        organizationId: w.org,
        email: `anna2-${w.mark}@example.invalid`,
        tokenHash: randomUUID().replaceAll('-', '').padEnd(64, '0'),
        expiresAt: new Date(Date.now() + 3600_000),
        createdBy: w.owner,
        role: 'EMPLOYEE',
        employeeId: w.employee,
      });
      await w.repo.acceptInvite({
        id: invite.id,
        now: new Date(),
        passwordTokenHash: randomUUID().replaceAll('-', '').padEnd(64, '0'),
        passwordExpiresAt: new Date(Date.now() + 3600_000),
      });
      const row = await tx.employee.findUniqueOrThrow({ where: { id: w.employee }, select: { userId: true } });
      expect(row.userId).toBe(other.id);
    });
  });

  it('список входов отдаёт карточки человека только своей организации, приглашение отдаёт карточку (один экран «Сотрудники»)', async () => {
    await rolledBack(async (tx) => {
      const w = await world(tx);
      await tx.employee.update({ where: { id: w.employee }, data: { userId: w.owner } });
      // тот же человек с карточкой в чужой организации: сюда она не попадает
      const otherOrg = await tx.organization.create({ data: { name: `Чужая ${w.mark}` }, select: { id: true } });
      const otherBiz = await tx.business.create({
        data: { organizationId: otherOrg.id, name: 'Кафе', vertical: 'FOOD_SERVICE' },
        select: { id: true },
      });
      await tx.employee.create({ data: { businessId: otherBiz.id, name: 'Владелец в кафе', userId: w.owner } });
      const newcomer = await tx.employee.create({ data: { businessId: w.biz, name: 'Новенькая' }, select: { id: true } });
      await w.repo.createInvite({
        organizationId: w.org,
        email: `new-${w.mark}@example.invalid`,
        tokenHash: randomUUID().replaceAll('-', '').padEnd(64, '0'),
        expiresAt: new Date(Date.now() + 3600_000),
        createdBy: w.owner,
        role: 'EMPLOYEE',
        employeeId: newcomer.id,
      });
      const members = await w.repo.members(w.org);
      expect(members.map((m) => [m.userId, m.employees])).toEqual([
        [w.owner, [{ employeeId: w.employee, businessId: w.biz }]],
      ]);
      const invites = await w.repo.pendingInvites(w.org, new Date());
      expect(invites.map((i) => i.employeeId)).toEqual([newcomer.id]);
    });
  });
});
