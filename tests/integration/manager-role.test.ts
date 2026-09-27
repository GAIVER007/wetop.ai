import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { hashSessionToken } from '@pms/domain';
import { newSessionToken } from '@pms/shared';
import { PrismaAccountsRepository } from '../../apps/api/src/accounts/accounts.prisma-repository';
import { AuditService } from '../../apps/api/src/audit/audit.module';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { SellerAgentsService } from '../../apps/api/src/wizard/seller-agents.service';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;
class Rollback extends Error {}

/**
 * Третья роль и сотрудники (ADR-100, DATA_MODEL v1.13, миграция 20260927000026): в типе роли три значения по порядку;
 * приглашение хранит роль и не может назначить владельца; принятое приглашение даёт роль из него; отключение удаляет
 * членство и пишет журнал организации; смена роли — тоже. Всё вымышленное (ADR-010) и откатывается транзакцией.
 */
describe.skipIf(!url)(
  'роли управляющего и администратора (integration, DATABASE_URL required)',
  () => {
    let db: Db;
    beforeAll(() => {
      db = createPrismaClient(url);
    });
    afterAll(async () => {
      await db?.$disconnect();
    });

    /** Всё внутри транзакции, которая откатывается: тестовая схема не меняется */
    async function rolledBack(fn: (tx: Db) => Promise<void>): Promise<void> {
      await expect(
        db.$transaction(async (tx) => {
          await fn(tx as unknown as Db);
          throw new Rollback();
        }),
      ).rejects.toBeInstanceOf(Rollback);
    }

    async function organization(tx: Db, people: Record<string, 'OWNER' | 'MANAGER' | 'STAFF'>) {
      const mark = randomUUID().slice(0, 8);
      const org = await tx.organization.create({
        data: { name: `Роли ${mark}` },
        select: { id: true },
      });
      const ids: Record<string, string> = {};
      for (const [who, role] of Object.entries(people)) {
        const user = await tx.user.create({
          data: { email: `${who}-${mark}@example.invalid`, name: `Тест ${who}` },
          select: { id: true },
        });
        await tx.membership.create({ data: { userId: user.id, organizationId: org.id, role } });
        ids[who] = user.id;
      }
      return { org: org.id, ids, mark };
    }

    /** Объект организации: журнал стойки открывает только организацию с объектом (ADR-061) */
    async function property(tx: Db, organizationId: string): Promise<void> {
      await tx.property.create({
        data: {
          organizationId,
          name: `Объект ${organizationId.slice(0, 8)} (integration)`,
          timezone: 'Asia/Almaty',
          currency: 'KZT',
          checkInTime: '14:00',
          checkOutTime: '12:00',
        },
      });
    }

    it('в типе роли три значения — владелец, управляющий, администратор', async () => {
      const rows = await db.$queryRaw<Array<{ roles: string }>>`
      SELECT enum_range(NULL::"MembershipRole")::text AS roles`;
      expect(rows[0]!.roles).toBe('{OWNER,MANAGER,STAFF}');
    });

    it('приглашение хранит роль, по умолчанию — администратор; владельца база не примет', async () => {
      await rolledBack(async (tx) => {
        const { org, ids } = await organization(tx, { owner: 'OWNER' });
        const base = {
          organizationId: org,
          createdBy: ids.owner!,
          expiresAt: new Date(Date.now() + 3_600_000),
        };
        const plain = await tx.invite.create({
          data: {
            ...base,
            email: 'plain@example.invalid',
            tokenHash: randomUUID().replace(/-/g, ''),
          },
        });
        expect(plain.role).toBe('STAFF');
        const manager = await tx.invite.create({
          data: {
            ...base,
            email: 'm@example.invalid',
            tokenHash: randomUUID().replace(/-/g, ''),
            role: 'MANAGER',
          },
        });
        expect(manager.role).toBe('MANAGER');
        await expect(
          tx.$executeRaw`INSERT INTO "invites" ("id", "organization_id", "email", "token_hash", "expires_at", "created_by", "role")
          VALUES (gen_random_uuid(), ${org}::uuid, 'boss@example.invalid', ${randomUUID()}, now() + interval '1 hour',
                  ${ids.owner}::uuid, 'OWNER')`,
        ).rejects.toThrow(/invites_role_not_owner/);
      });
    });

    it('сессия знает, заблокирован ли человек и есть ли ещё членство (С-4, С-10)', async () => {
      await rolledBack(async (tx) => {
        const { org, ids } = await organization(tx, { owner: 'OWNER', admin: 'STAFF' });
        const repo = new PrismaAccountsRepository({ db: tx } as PrismaService);
        // отпечаток сессии база принимает только в виде HMAC-SHA256 (`sessions_token_hash_shape`)
        const tokenHash = hashSessionToken(newSessionToken());
        await tx.session.create({
          data: {
            tokenHash,
            userId: ids.admin!,
            organizationId: org,
            expiresAt: new Date(Date.now() + 3_600_000),
          },
        });
        expect(await repo.sessionByTokenHash(tokenHash)).toMatchObject({
          member: true,
          userStatus: 'ACTIVE',
          role: 'STAFF',
        });
        await tx.user.update({ where: { id: ids.admin! }, data: { status: 'BLOCKED' } });
        await tx.membership.delete({
          where: { userId_organizationId: { userId: ids.admin!, organizationId: org } },
        });
        expect(await repo.sessionByTokenHash(tokenHash)).toMatchObject({
          member: false,
          userStatus: 'BLOCKED',
        });
      });
    });

    it('хранилище: приглашение с ролью, отзыв по роли, вступление с ролью из приглашения', async () => {
      await rolledBack(async (tx) => {
        const { org, ids, mark } = await organization(tx, { owner: 'OWNER' });
        const repo = new PrismaAccountsRepository({ db: tx } as PrismaService);
        const invite = await repo.createInvite({
          organizationId: org,
          email: `boss-${mark}@example.invalid`,
          tokenHash: randomUUID().replace(/-/g, ''),
          expiresAt: new Date(Date.now() + 3_600_000),
          createdBy: ids.owner!,
          role: 'MANAGER',
        });
        expect(invite.role).toBe('MANAGER');
        expect((await repo.pendingInvites(org, new Date())).map((i) => i.role)).toEqual([
          'MANAGER',
        ]);
        // управляющий отзывает только приглашения администраторов: чужое по роли — «не найдено»
        expect(await repo.revokeInvite(invite.id, org, new Date(), ['STAFF'])).toBe(false);

        const joined = await repo.joinOrganization({
          email: invite.email,
          organizationId: org,
          role: invite.role,
        });
        expect(joined.role).toBe('MANAGER');
        // повторное вступление роль не меняет
        expect(
          (await repo.joinOrganization({ email: invite.email, organizationId: org, role: 'STAFF' }))
            .role,
        ).toBe('MANAGER');
      });
    });

    it('сотрудники по порядку ролей; отключение и смена роли — вместе с записью в журнале организации', async () => {
      await rolledBack(async (tx) => {
        const { org, ids } = await organization(tx, {
          admin: 'STAFF',
          owner: 'OWNER',
          manager: 'MANAGER',
        });
        const repo = new PrismaAccountsRepository({ db: tx } as PrismaService);
        expect((await repo.members(org)).map((m) => m.role)).toEqual(['OWNER', 'MANAGER', 'STAFF']);

        const desk = ['MANAGER', 'STAFF'] as const;
        expect(
          await repo.setMemberRole({
            organizationId: org,
            userId: ids.admin!,
            role: 'MANAGER',
            by: ids.owner!,
            from: desk,
          }),
        ).toEqual({ outcome: 'done', role: 'STAFF' });
        // роль сверяется в момент записи: управляющий (право — только на администраторов) нового управляющего не удалит
        expect(
          await repo.removeMember({
            organizationId: org,
            userId: ids.admin!,
            by: ids.manager!,
            roles: ['STAFF'],
          }),
        ).toEqual({ outcome: 'role', role: 'MANAGER' });
        // владельца смена роли со стойки не задевает
        expect(
          await repo.setMemberRole({
            organizationId: org,
            userId: ids.owner!,
            role: 'STAFF',
            by: ids.owner!,
            from: desk,
          }),
        ).toEqual({ outcome: 'role', role: 'OWNER' });
        expect(
          await repo.removeMember({
            organizationId: org,
            userId: ids.manager!,
            by: ids.owner!,
            roles: desk,
          }),
        ).toEqual({ outcome: 'done', role: 'MANAGER' });
        // повторное «Отключить» — «нет такого», а не сбой базы
        expect(
          await repo.removeMember({
            organizationId: org,
            userId: ids.manager!,
            by: ids.owner!,
            roles: desk,
          }),
        ).toEqual({ outcome: 'missing', role: null });
        expect((await repo.members(org)).map((m) => [m.userId, m.role])).toEqual([
          [ids.owner, 'OWNER'],
          [ids.admin, 'MANAGER'],
        ]);

        // время строк в одной транзакции одинаковое — порядок по названию действия
        const journal = await tx.auditLog.findMany({
          where: { entityType: 'organization', entityId: org },
          orderBy: { action: 'asc' },
          select: { userId: true, action: true, before: true, after: true },
        });
        expect(journal).toEqual([
          {
            userId: ids.owner,
            action: 'membership.removed',
            before: { userId: ids.manager, role: 'MANAGER' },
            after: null,
          },
          {
            userId: ids.owner,
            action: 'membership.role.updated',
            before: { userId: ids.admin, role: 'STAFF' },
            after: { userId: ids.admin, role: 'MANAGER' },
          },
        ]);

        // журнал стойки показывает эти строки своей организации и не показывает чужой
        const audit = new AuditService({ db: tx } as unknown as PrismaService);
        const other = await organization(tx, { stranger: 'OWNER' });
        await property(tx, org);
        await property(tx, other.org);
        const own = await withSignedInUser(
          { userId: ids.owner!, organizationId: org, role: 'OWNER' },
          () => audit.list({ action: 'membership.' }),
        );
        expect(own.map((r) => r.action).sort()).toEqual([
          'membership.removed',
          'membership.role.updated',
        ]);
        const foreign = await withSignedInUser(
          { userId: other.ids.stranger!, organizationId: other.org, role: 'OWNER' },
          () => audit.list({ action: 'membership.' }),
        );
        expect(foreign).toEqual([]);
      });
    });

    it('агенты продавца: управляющему — можно, администратору — нет (ADR-100)', async () => {
      const before = process.env.WIZARD_ENABLED;
      process.env.WIZARD_ENABLED = '1';
      try {
        await rolledBack(async (tx) => {
          const { org, ids } = await organization(tx, { manager: 'MANAGER', admin: 'STAFF' });
          await tx.organization.update({ where: { id: org }, data: { status: 'ACTIVE' } });
          await tx.user.updateMany({
            where: { id: { in: [ids.manager!, ids.admin!] } },
            data: { emailVerifiedAt: new Date() },
          });
          const agents = new SellerAgentsService({ db: tx } as PrismaService);
          const listed = await withSignedInUser(
            { userId: ids.manager!, organizationId: org, role: 'MANAGER' },
            () => agents.list(),
          );
          expect(listed.items).toEqual([]);
          await expect(
            withSignedInUser({ userId: ids.admin!, organizationId: org, role: 'STAFF' }, () =>
              agents.list(),
            ),
          ).rejects.toThrow(/владелец и управляющий/);
        });
      } finally {
        if (before === undefined) delete process.env.WIZARD_ENABLED;
        else process.env.WIZARD_ENABLED = before;
      }
    });
  },
);
