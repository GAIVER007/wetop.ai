import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import type { MembershipRole } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import type {
  AccountRecord,
  AccountsRepository,
  InviteRecord,
  MemberRecord,
  MemberWrite,
  SessionListRecord,
  SessionRecord,
} from './accounts.repository';

/**
 * Учётные записи в базе (DATA_MODEL §13). Ни кодов, ни ключей сессий здесь нет — только их
 * отпечатки: они приходят сюда уже посчитанными.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
@Injectable()
export class PrismaAccountsRepository implements AccountsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Пользователь и его организация. Организаций у человека может быть несколько (приглашения,
   * этап 7); пока берём первую по времени вступления — выбор организации будет отдельным шагом.
   */
  async accountByEmail(email: string): Promise<AccountRecord | null> {
    const user = await this.prisma.db.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        status: true,
        memberships: {
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: {
            role: true,
            organization: {
              select: { id: true, name: true, status: true, trialEndsAt: true },
            },
          },
        },
      },
    });
    if (!user || user.status !== 'ACTIVE') return null;
    const org = user.memberships[0]?.organization;
    const role = user.memberships[0]?.role;
    if (!org || !role) return null;
    return {
      userId: user.id,
      email: user.email,
      organizationId: org.id,
      organizationName: org.name,
      organizationStatus: org.status,
      trialEndsAt: org.trialEndsAt,
      role,
    };
  }

  /**
   * Три строки в одной транзакции: организация, человек, членство. Занятый адрес ловим по
   * нарушению уникальности `users.email` (Prisma P2002), а не проверкой «есть ли такой» перед
   * вставкой: две одновременные регистрации на один адрес иначе заведут две организации.
   */
  async createAccount(input: {
    email: string;
    organizationName: string;
    trialEndsAt: Date;
  }): Promise<AccountRecord | null> {
    try {
      return await this.prisma.db.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: { name: input.organizationName, status: 'TRIAL', trialEndsAt: input.trialEndsAt },
          select: { id: true, name: true, status: true, trialEndsAt: true },
        });
        const user = await tx.user.create({
          data: { email: input.email, status: 'ACTIVE' },
          select: { id: true, email: true },
        });
        // заведший организацию — её владелец (DATA_MODEL §16.1, ADR-083)
        await tx.membership.create({
          data: { userId: user.id, organizationId: org.id, role: 'OWNER' },
        });
        return {
          userId: user.id,
          email: user.email,
          organizationId: org.id,
          organizationName: org.name,
          organizationStatus: org.status,
          trialEndsAt: org.trialEndsAt,
          role: 'OWNER' as const,
        };
      });
    } catch (e) {
      if (isUniqueViolation(e)) return null;
      throw e;
    }
  }

  async markLogin(userId: string, at: Date): Promise<void> {
    await this.prisma.db.user.update({ where: { id: userId }, data: { lastLoginAt: at } });
  }

  async sessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const row = await this.prisma.db.session.findUnique({
      where: { tokenHash },
      select: {
        expiresAt: true,
        revokedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            status: true,
            // членств у человека одно-два: роль берём у организации этой сессии
            memberships: { select: { organizationId: true, role: true } },
          },
        },
        organization: { select: { id: true, name: true, status: true, trialEndsAt: true } },
      },
    });
    if (!row) return null;
    const role = row.user.memberships.find((m) => m.organizationId === row.organization.id)?.role;
    return {
      userId: row.user.id,
      email: row.user.email,
      organizationId: row.organization.id,
      organizationName: row.organization.name,
      organizationStatus: row.organization.status,
      trialEndsAt: row.organization.trialEndsAt,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      // членство сняли — прав владельца точно нет, а `member: false` сессию и вовсе не пустит
      role: role ?? 'STAFF',
      userStatus: row.user.status,
      member: role !== undefined,
    };
  }

  /** Повторный выход по тому же ключу — не ошибка: строки может уже не быть. */
  async revokeSession(tokenHash: string, at: Date): Promise<void> {
    await this.prisma.db.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: at },
    });
  }

  /** «Где я вошёл»: живые сессии человека, новые сверху. */
  async sessionsForUser(userId: string, now: Date): Promise<SessionListRecord[]> {
    return this.prisma.db.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { issuedAt: 'desc' },
      select: { id: true, tokenHash: true, issuedAt: true, expiresAt: true, userAgent: true },
    });
  }

  /** «Выйти везде»: отзыв всех живых строк человека одним запросом; чужие строки не трогаем. */
  async revokeAllSessions(userId: string, at: Date): Promise<number> {
    const r = await this.prisma.db.session.updateMany({
      where: { userId, revokedAt: null, expiresAt: { gt: at } },
      data: { revokedAt: at },
    });
    return r.count;
  }

  // ── Приглашения (этап 7, DATA_MODEL §13.6) ──────────────────────────────────────────────────
  async createInvite(input: {
    organizationId: string;
    email: string;
    tokenHash: string;
    expiresAt: Date;
    createdBy: string;
    role: MembershipRole;
  }): Promise<InviteRecord> {
    const row = await this.prisma.db.invite.create({
      data: {
        organizationId: input.organizationId,
        email: input.email,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        createdBy: input.createdBy,
        role: input.role,
      },
      select: INVITE_SELECT,
    });
    return toInviteRecord(row);
  }

  async pendingInvites(organizationId: string, now: Date): Promise<InviteRecord[]> {
    const rows = await this.prisma.db.invite.findMany({
      where: { organizationId, acceptedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
      select: INVITE_SELECT,
    });
    return rows.map(toInviteRecord);
  }

  async invitesCreatedSince(organizationId: string, since: Date): Promise<number> {
    return this.prisma.db.invite.count({ where: { organizationId, createdAt: { gte: since } } });
  }

  async revokeInvite(
    id: string,
    organizationId: string,
    at: Date,
    roles: readonly MembershipRole[],
  ): Promise<boolean> {
    // id из адреса: не uuid — такого приглашения нет, а не ошибка базы
    if (!UUID.test(id)) return false;
    const { count } = await this.prisma.db.invite.updateMany({
      where: {
        id,
        organizationId,
        acceptedAt: null,
        expiresAt: { gt: at },
        role: { in: [...roles] },
      },
      data: { expiresAt: at },
    });
    return count > 0;
  }

  async inviteByTokenHash(tokenHash: string): Promise<InviteRecord | null> {
    const row = await this.prisma.db.invite.findUnique({
      where: { tokenHash },
      select: INVITE_SELECT,
    });
    return row ? toInviteRecord(row) : null;
  }

  /** Принимается один раз: повторная отметка ничего не меняет. */
  async markInviteAccepted(id: string, at: Date): Promise<void> {
    await this.prisma.db.invite.updateMany({
      where: { id, acceptedAt: null },
      data: { acceptedAt: at },
    });
  }

  async isMember(email: string, organizationId: string): Promise<boolean> {
    const n = await this.prisma.db.membership.count({ where: { organizationId, user: { email } } });
    return n > 0;
  }

  /**
   * Человек и членство одной транзакцией. Человека ищем по почте (уникальна), членство — по
   * составному ключу: второе вступление того же человека ничего не дублирует и не падает.
   */
  async joinOrganization(input: {
    email: string;
    organizationId: string;
    role: MembershipRole;
  }): Promise<AccountRecord> {
    return this.prisma.db.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { email: input.email },
        create: { email: input.email, status: 'ACTIVE' },
        update: {},
        select: { id: true, email: true },
      });
      // роль — из приглашения (DATA_MODEL §13.6, §16.1 v1.13); уже состоящему роль не меняется
      const membership = await tx.membership.upsert({
        where: { userId_organizationId: { userId: user.id, organizationId: input.organizationId } },
        create: { userId: user.id, organizationId: input.organizationId, role: input.role },
        update: {},
        select: { role: true },
      });
      const org = await tx.organization.findUniqueOrThrow({
        where: { id: input.organizationId },
        select: { id: true, name: true, status: true, trialEndsAt: true },
      });
      return {
        userId: user.id,
        email: user.email,
        organizationId: org.id,
        organizationName: org.name,
        organizationStatus: org.status,
        trialEndsAt: org.trialEndsAt,
        role: membership.role,
      };
    });
  }

  // ── Сотрудники (ADR-101, DATA_MODEL §16.1 v1.13) ────────────────────────────────────────────

  async members(organizationId: string): Promise<MemberRecord[]> {
    // порядок перечисления в базе — OWNER, MANAGER, STAFF (миграция 20260927000026): владельцы сверху
    const rows = await this.prisma.db.membership.findMany({
      where: { organizationId },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }, { userId: 'asc' }],
      select: {
        role: true,
        createdAt: true,
        user: { select: { id: true, email: true, name: true } },
      },
    });
    return rows.map((m) => ({
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      joinedAt: m.createdAt,
    }));
  }

  async removeMember(input: {
    organizationId: string;
    userId: string;
    by: string;
    roles: readonly MembershipRole[];
  }): Promise<MemberWrite> {
    if (!UUID.test(input.userId)) return { outcome: 'missing', role: null };
    return this.prisma.db.$transaction(async (tx) => {
      // строка под блокировкой: вторая такая же команда ждёт и видит, что членства уже нет, — без сбоя P2025
      const role = await lockedRole(tx, input.organizationId, input.userId);
      if (!role) return { outcome: 'missing', role: null };
      if (!input.roles.includes(role)) return { outcome: 'role', role };
      await tx.membership.delete({
        where: {
          userId_organizationId: { userId: input.userId, organizationId: input.organizationId },
        },
      });
      // в журнале организации: строка о человеке ушла бы из виду вместе с его членством
      await tx.auditLog.create({
        data: {
          userId: input.by,
          entityType: 'organization',
          entityId: input.organizationId,
          action: 'membership.removed',
          before: { userId: input.userId, role },
        },
      });
      return { outcome: 'done', role };
    });
  }

  async setMemberRole(input: {
    organizationId: string;
    userId: string;
    role: MembershipRole;
    by: string;
    from: readonly MembershipRole[];
  }): Promise<MemberWrite> {
    if (!UUID.test(input.userId)) return { outcome: 'missing', role: null };
    return this.prisma.db.$transaction(async (tx) => {
      const before = await lockedRole(tx, input.organizationId, input.userId);
      if (!before) return { outcome: 'missing', role: null };
      if (!input.from.includes(before)) return { outcome: 'role', role: before };
      const key = {
        userId_organizationId: { userId: input.userId, organizationId: input.organizationId },
      };
      await tx.membership.update({ where: key, data: { role: input.role } });
      await tx.auditLog.create({
        data: {
          userId: input.by,
          entityType: 'organization',
          entityId: input.organizationId,
          action: 'membership.role.updated',
          before: { userId: input.userId, role: before },
          after: { userId: input.userId, role: input.role },
        },
      });
      return { outcome: 'done', role: before };
    });
  }

  async issuePasswordSetToken(input: {
    email: string;
    tokenHash: string;
    expiresAt: Date;
    now: Date;
  }): Promise<boolean> {
    const user = await this.prisma.db.user.findUnique({
      where: { email: input.email },
      select: { id: true, status: true, passwordHash: true },
    });
    if (!user || user.status !== 'ACTIVE' || user.passwordHash !== '') return false;
    await this.prisma.db.passwordReset.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: input.now },
    });
    await this.prisma.db.passwordReset.create({
      data: { userId: user.id, tokenHash: input.tokenHash, expiresAt: input.expiresAt },
    });
    return true;
  }
}

const INVITE_SELECT = {
  id: true,
  organizationId: true,
  email: true,
  expiresAt: true,
  acceptedAt: true,
  createdAt: true,
  role: true,
  organization: { select: { name: true } },
} as const;

function toInviteRecord(row: {
  id: string;
  organizationId: string;
  email: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
  role: MembershipRole;
  organization: { name: string };
}): InviteRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    organizationName: row.organization.name,
    email: row.email,
    expiresAt: row.expiresAt,
    acceptedAt: row.acceptedAt,
    createdAt: row.createdAt,
    role: row.role,
  };
}

/** Роль в членстве под блокировкой строки до конца транзакции (`FOR UPDATE`); `null` — членства нет */
async function lockedRole(
  tx: Pick<PrismaService['db'], '$queryRaw'>,
  organizationId: string,
  userId: string,
): Promise<MembershipRole | null> {
  const rows = await tx.$queryRaw<Array<{ role: MembershipRole }>>`
    SELECT "role"::text AS "role" FROM "memberships"
    WHERE "user_id" = ${userId}::uuid AND "organization_id" = ${organizationId}::uuid
    FOR UPDATE`;
  return rows[0]?.role ?? null;
}

/** Код P2002 у Prisma — нарушение уникального индекса. Другие ошибки базы не глотаем. */
function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'P2002';
}
