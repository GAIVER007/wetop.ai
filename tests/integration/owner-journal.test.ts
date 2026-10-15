import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { AuditService } from '../../apps/api/src/audit/audit.module';
import { PrismaAccountsRepository } from '../../apps/api/src/accounts/accounts.prisma-repository';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { purgeAuditRows } from '../tools/audit-purge';

const url = process.env.DATABASE_URL;
describe.skipIf(!url)('журнал владельца и принятие приглашения: PostgreSQL', () => {
  let db: Db;
  let service: AuditService;
  let accounts: PrismaAccountsRepository;
  let org: string;
  let foreign: string;
  let actor: string;
  const mark = randomUUID();
  const emails = [
    `actor-${mark}@example.test`,
    `join-${mark}@example.test`,
    `retry-${mark}@example.test`,
  ];
  const own = <T>(fn: () => Promise<T>) =>
    withSignedInUser({ userId: actor, organizationId: org, role: 'OWNER' }, fn);

  beforeAll(async () => {
    db = createPrismaClient(url);
    org = (await db.property.findFirstOrThrow()).organizationId;
    foreign = (
      await db.organization.create({ data: { name: `Другой объект ${mark}`, status: 'ACTIVE' } })
    ).id;
    actor = (
      await db.user.create({
        data: { email: emails[0]!, name: 'Тестовый кассир', status: 'ACTIVE' },
      })
    ).id;
    await db.membership.create({ data: { organizationId: org, userId: actor, role: 'STAFF' } });
    service = new AuditService({ db } as PrismaService);
    accounts = new PrismaAccountsRepository({ db } as PrismaService);
    for (const [i, stamp] of [
      '2026-10-04T19:00:00.123999Z',
      '2026-10-04T19:00:00.123998Z',
      '2026-10-04T19:00:00.123998Z',
    ].entries()) {
      const after = JSON.stringify({
        amountMinor: '9007199254740993123',
        method: 'CASH',
        passport: 'PRIVATE-DOCUMENT',
        tokenHash: 'PRIVATE-TOKEN',
        guest: { name: 'PRIVATE-NAME' },
      });
      await db.$executeRaw`INSERT INTO audit_logs (id, organization_id, user_id, entity_type, entity_id, action, created_at, "after")
        VALUES (${randomUUID()}::uuid, ${org}::uuid, ${actor}::uuid, 'CashOperation', ${mark}, ${`finance.test.${i}`}, ${stamp}::timestamptz, ${after}::jsonb)`;
    }
    await db.auditLog.create({
      data: {
        organizationId: foreign,
        userId: actor,
        entityType: 'CashOperation',
        entityId: mark,
        action: 'finance.test.foreign',
      },
    });
  });

  afterAll(async () => {
    if (!db) return;
    const users = await db.user.findMany({
      where: { email: { in: emails } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    await purgeAuditRows(db, { OR: [{ entityId: mark }, { userId: { in: ids } }] });
    await db.invite.deleteMany({ where: { email: { in: emails } } });
    await db.passwordReset.deleteMany({ where: { userId: { in: ids } } });
    await db.membership.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.organization.delete({ where: { id: foreign } });
    await db.$disconnect();
  });

  it('безопасные поля, локальные сутки, изоляция организации и курсор без потери микросекунд', async () => {
    const filters = {
      actor,
      action: 'finance.test.',
      from: '2026-10-05',
      to: '2026-10-05',
      timezone: 'Asia/Almaty',
      limit: 1,
    };
    const ids: string[] = [];
    let cursor: string | undefined;
    for (let i = 0; i < 4; i++) {
      const rows = await own(() => service.list({ ...filters, cursor }));
      if (!rows.length) break;
      const row = rows[0]!;
      ids.push(row.id);
      cursor = row.cursor;
      expect(row.authorId).toBe(actor);
      expect(row.after).toEqual({ amountMinor: '9007199254740993123', method: 'CASH' });
      expect(JSON.stringify(row)).not.toContain('PRIVATE');
      expect(row.action).not.toContain('foreign');
    }
    expect(new Set(ids).size).toBe(3);
    expect(ids).toHaveLength(3);
    expect(
      await own(() => service.list({ ...filters, from: '2026-10-04', to: '2026-10-04' })),
    ).toEqual([]);
  });

  it('отключение сотрудника не скрывает историю и автора из фильтра', async () => {
    await accounts.removeMember({
      organizationId: org,
      userId: actor,
      by: actor,
      roles: ['STAFF'],
    });
    expect(await own(() => service.list({ actor, action: 'finance.test.' }))).toHaveLength(3);
    expect(await own(() => service.actors())).toContainEqual({
      id: actor,
      name: 'Тестовый кассир',
    });
  });

  it('владелец видит журнал организации до настройки гостиницы', async () => {
    const rows = await withSignedInUser(
      { userId: actor, organizationId: foreign, role: 'OWNER' },
      () => service.list({ action: 'finance.test.' }),
    );
    expect(rows.map((r) => r.action)).toEqual(['finance.test.foreign']);
  });

  it('два принятия: одно членство, одна запись аудита, одна ссылка на пароль', async () => {
    const invite = await accounts.createInvite({
      organizationId: org,
      email: emails[1]!,
      createdBy: actor,
      role: 'STAFF',
      expiresAt: new Date(Date.now() + 3600000),
      tokenHash: randomUUID(),
    });
    const input = {
      id: invite.id,
      now: new Date(),
      passwordTokenHash: mark,
      passwordExpiresAt: new Date(Date.now() + 3600000),
    };
    const accepted = await Promise.all([
      accounts.acceptInvite(input),
      accounts.acceptInvite(input),
    ]);
    expect(accepted.filter(Boolean)).toEqual([{ passwordTokenIssued: true }]);
    expect(
      await db.membership.count({ where: { organizationId: org, user: { email: emails[1]! } } }),
    ).toBe(1);
    expect(
      await db.auditLog.count({
        where: { action: 'invite.accepted', after: { path: ['inviteId'], equals: invite.id } },
      }),
    ).toBe(1);
  });

  it('сбой выдачи пароля откатывает принятие и членство, повтор после сбоя успешен', async () => {
    const invite = await accounts.createInvite({
      organizationId: org,
      email: emails[2]!,
      createdBy: actor,
      role: 'STAFF',
      expiresAt: new Date(Date.now() + 3600000),
      tokenHash: randomUUID(),
    });
    const input = {
      id: invite.id,
      now: new Date(),
      passwordTokenHash: mark,
      passwordExpiresAt: new Date(Date.now() + 3600000),
    };
    await expect(accounts.acceptInvite(input)).rejects.toThrow();
    expect((await db.invite.findUniqueOrThrow({ where: { id: invite.id } })).acceptedAt).toBeNull();
    expect(
      await db.membership.count({ where: { organizationId: org, user: { email: emails[2]! } } }),
    ).toBe(0);
    expect(await accounts.acceptInvite({ ...input, passwordTokenHash: randomUUID() })).toEqual({
      passwordTokenIssued: true,
    });
  });
});
