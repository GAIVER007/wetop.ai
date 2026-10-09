import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import { membershipRoleFor, type MembershipRole, type ScopeAssignment } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import type {
  AccountRecord,
  AccountsRepository,
  InviteRecord,
  MemberRecord,
  MemberWrite,
  OrganizationStructure,
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
          // приостановленный член в организацию не входит (§30.2)
          where: { status: 'ACTIVE' },
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
            memberships: { select: { organizationId: true, role: true, status: true } },
          },
        },
        organization: { select: { id: true, name: true, status: true, trialEndsAt: true } },
      },
    });
    if (!row) return null;
    const membership = row.user.memberships.find((m) => m.organizationId === row.organization.id);
    const role = membership?.role;
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
      // приостановленного сессия не пускает так же, как отключённого (§30.2)
      member: role !== undefined && membership?.status === 'ACTIVE',
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
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    position?: string | null;
    scopes?: ScopeAssignment[];
  }): Promise<InviteRecord> {
    return this.prisma.db.$transaction(async (tx) => {
      const { scopes, ...rest } = input;
      const row = await tx.invite.create({
        data: {
          ...rest,
          ...(scopes && scopes.length > 0 ? { scopes: scopes.map(plainScope) } : {}),
        },
        select: INVITE_SELECT,
      });
      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          userId: input.createdBy,
          entityType: 'organization',
          entityId: input.organizationId,
          action: 'invite.created',
          after: { inviteId: row.id, role: input.role, scopes: input.scopes?.length ?? 0 },
        },
      });
      return toInviteRecord(row);
    });
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
    by?: string,
    deliveryFailed = false,
  ): Promise<boolean> {
    if (!UUID.test(id)) return false;
    return this.prisma.db.$transaction(async (tx) => {
      const { count } = await tx.invite.updateMany({
        where: {
          id,
          organizationId,
          acceptedAt: null,
          expiresAt: { gt: at },
          role: { in: [...roles] },
        },
        data: { expiresAt: at },
      });
      if (!count) return false;
      await tx.auditLog.create({
        data: {
          organizationId,
          userId: by ?? null,
          entityType: 'organization',
          entityId: organizationId,
          action: 'invite.revoked',
          after: { inviteId: id, deliveryFailed },
        },
      });
      return true;
    });
  }

  async acceptInvite(input: {
    id: string;
    now: Date;
    passwordTokenHash: string;
    passwordExpiresAt: Date;
  }): Promise<{ passwordTokenIssued: boolean } | null> {
    return this.prisma.db.$transaction(async (tx) => {
      // UPDATE блокирует приглашение: конкурентный приём или отзыв увидит итог первой транзакции.
      const claimed = await tx.invite.updateMany({
        where: { id: input.id, acceptedAt: null, expiresAt: { gt: input.now } },
        data: { acceptedAt: input.now },
      });
      if (!claimed.count) return null;
      const invite = await tx.invite.findUniqueOrThrow({ where: { id: input.id } });
      const invitedName = [invite.firstName, invite.lastName].filter(Boolean).join(' ') || null;
      const user = await tx.user.upsert({
        where: { email: invite.email },
        create: { email: invite.email, status: 'ACTIVE', name: invitedName },
        update: {},
        select: { id: true, status: true, passwordHash: true },
      });
      const member = await tx.membership.upsert({
        where: {
          userId_organizationId: { userId: user.id, organizationId: invite.organizationId },
        },
        create: {
          userId: user.id,
          organizationId: invite.organizationId,
          role: invite.role,
          phone: invite.phone,
          position: invite.position,
        },
        update: {},
        select: { role: true },
      });
      // назначения приглашения (DATA_MODEL §30.3): бизнес или филиал могли архивироваться, пока приглашение ждало
      const wanted = parseStoredScopes(invite.scopes);
      if (wanted.length > 0) {
        const [businesses, locations] = await Promise.all([
          tx.business.findMany({
            where: {
              organizationId: invite.organizationId,
              status: 'ACTIVE',
              id: { in: wanted.map((w) => w.businessId) },
            },
            select: { id: true },
          }),
          tx.location.findMany({
            where: {
              status: 'ACTIVE',
              id: { in: wanted.flatMap((w) => (w.locationId ? [w.locationId] : [])) },
            },
            select: { id: true, businessId: true },
          }),
        ]);
        const live = wanted.filter(
          (w) =>
            businesses.some((b) => b.id === w.businessId) &&
            (w.locationId === null ||
              locations.some((l) => l.id === w.locationId && l.businessId === w.businessId)),
        );
        // только для нового члена: уже состоящему область не меняется (как и роль)
        const existing = await tx.membershipScope.count({
          where: { organizationId: invite.organizationId, userId: user.id },
        });
        if (live.length > 0 && existing === 0) {
          await tx.membershipScope.createMany({
            data: live.map((w) => ({
              organizationId: invite.organizationId,
              userId: user.id,
              role: w.role,
              businessId: w.businessId,
              locationId: w.locationId,
              createdBy: invite.createdBy,
            })),
          });
          await tx.membership.update({
            where: {
              userId_organizationId: { userId: user.id, organizationId: invite.organizationId },
            },
            data: { role: membershipRoleFor(live, invite.role) },
          });
        }
      }
      const passwordTokenIssued = user.status === 'ACTIVE' && user.passwordHash === '';
      if (passwordTokenIssued) {
        await tx.passwordReset.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: input.now },
        });
        await tx.passwordReset.create({
          data: {
            userId: user.id,
            tokenHash: input.passwordTokenHash,
            expiresAt: input.passwordExpiresAt,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          organizationId: invite.organizationId,
          userId: user.id,
          entityType: 'organization',
          entityId: invite.organizationId,
          action: 'invite.accepted',
          after: { inviteId: invite.id, userId: user.id, role: member.role },
        },
      });
      return { passwordTokenIssued };
    });
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
      // роль — из приглашения (DATA_MODEL §13.6, §16.1 v1.14); уже состоящему роль не меняется
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

  // ── Сотрудники (ADR-107, DATA_MODEL §16.1 v1.14) ────────────────────────────────────────────

  async members(organizationId: string): Promise<MemberRecord[]> {
    // порядок перечисления в базе — OWNER, MANAGER, STAFF (миграция 20260927000029): владельцы сверху
    const query = (withLastLogin: boolean) =>
      this.prisma.db.membership.findMany({
        where: { organizationId },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }, { userId: 'asc' }],
        select: {
          role: true,
          createdAt: true,
          phone: true,
          position: true,
          status: true,
          user: { select: { id: true, email: true, name: true, lastLoginAt: withLastLogin } },
        },
      });
    let rows: Array<{
      role: MembershipRole;
      createdAt: Date;
      phone: string | null;
      position: string | null;
      status: 'ACTIVE' | 'SUSPENDED';
      user: { id: string; email: string; name: string | null; lastLoginAt?: Date | null };
    }>;
    try {
      rows = await query(true);
    } catch {
      // SEC-1b: у роли wetop_app может не быть гранта на users.last_login_at (его даёт миграция 042);
      // список сотрудников важнее даты входа — отдаём без неё, а не роняем экран «Сотрудники»
      rows = await query(false);
    }
    const scopeRows = await this.prisma.db.membershipScope.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
      select: { userId: true, role: true, businessId: true, locationId: true },
    });
    const scopesOf = (userId: string): ScopeAssignment[] =>
      scopeRows
        .filter((r) => r.userId === userId && r.role !== 'OWNER')
        .map((r) => ({
          role: r.role as 'MANAGER' | 'STAFF',
          businessId: r.businessId,
          locationId: r.locationId,
        }));
    return rows.map((m) => ({
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      joinedAt: m.createdAt,
      lastLoginAt: m.user.lastLoginAt ?? null,
      phone: m.phone,
      position: m.position,
      suspended: m.status === 'SUSPENDED',
      scopes: scopesOf(m.user.id),
    }));
  }

  async organizationStructure(organizationId: string): Promise<OrganizationStructure> {
    const rows = await this.prisma.db.business.findMany({
      where: { organizationId, status: 'ACTIVE' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        vertical: true,
        locations: {
          where: { status: 'ACTIVE' },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: { id: true, name: true },
        },
      },
    });
    return { businesses: rows };
  }

  async replaceMemberScopes(input: {
    organizationId: string;
    userId: string;
    assignments: ScopeAssignment[];
    by: string;
    roles: readonly MembershipRole[];
  }): Promise<MemberWrite> {
    if (!UUID.test(input.userId)) return { outcome: 'missing', role: null };
    return this.prisma.db.$transaction(async (tx) => {
      const role = await lockedRole(tx, input.organizationId, input.userId);
      if (!role) return { outcome: 'missing', role: null };
      if (!input.roles.includes(role)) return { outcome: 'role', role };
      const key = { organizationId: input.organizationId, userId: input.userId };
      const before = await tx.membershipScope.findMany({
        where: key,
        select: { role: true, businessId: true, locationId: true },
        orderBy: { createdAt: 'asc' },
      });
      await tx.membershipScope.deleteMany({ where: key });
      if (input.assignments.length > 0) {
        await tx.membershipScope.createMany({
          data: input.assignments.map((a) => ({
            ...key,
            role: a.role,
            businessId: a.businessId,
            locationId: a.locationId,
            createdBy: input.by,
          })),
        });
        await tx.membership.update({
          where: { userId_organizationId: key },
          data: { role: membershipRoleFor(input.assignments, role) },
        });
      }
      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          userId: input.by,
          entityType: 'organization',
          entityId: input.organizationId,
          action: 'membership.scope.updated',
          before: { userId: input.userId, scopes: before.map(plainScope) },
          after: { userId: input.userId, scopes: input.assignments.map(plainScope) },
        },
      });
      return { outcome: 'done', role };
    });
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

  async setMemberDetails(input: {
    organizationId: string;
    userId: string;
    phone: string | null;
    position: string | null;
    by: string;
    roles: readonly MembershipRole[] | null;
  }): Promise<MemberWrite> {
    if (!UUID.test(input.userId)) return { outcome: 'missing', role: null };
    return this.prisma.db.$transaction(async (tx) => {
      const role = await lockedRole(tx, input.organizationId, input.userId);
      if (!role) return { outcome: 'missing', role: null };
      if (input.roles && !input.roles.includes(role)) return { outcome: 'role', role };
      const key = {
        userId_organizationId: { userId: input.userId, organizationId: input.organizationId },
      };
      const before = await tx.membership.findUniqueOrThrow({
        where: key,
        select: { phone: true, position: true },
      });
      await tx.membership.update({
        where: key,
        data: { phone: input.phone, position: input.position },
      });
      await tx.auditLog.create({
        data: {
          userId: input.by,
          entityType: 'organization',
          entityId: input.organizationId,
          action: 'membership.details.updated',
          // номер телефона в журнал не пишем: журнал только дописывается (v1.7), стереть его оттуда нельзя
          before: { userId: input.userId, position: before.position },
          after: {
            userId: input.userId,
            position: input.position,
            phoneChanged: before.phone !== input.phone,
          },
        },
      });
      return { outcome: 'done', role };
    });
  }

  async setMemberSuspended(input: {
    organizationId: string;
    userId: string;
    suspended: boolean;
    by: string;
    roles: readonly MembershipRole[];
  }): Promise<MemberWrite> {
    if (!UUID.test(input.userId)) return { outcome: 'missing', role: null };
    return this.prisma.db.$transaction(async (tx) => {
      const role = await lockedRole(tx, input.organizationId, input.userId);
      if (!role) return { outcome: 'missing', role: null };
      if (!input.roles.includes(role)) return { outcome: 'role', role };
      const at = new Date();
      await tx.membership.update({
        where: {
          userId_organizationId: { userId: input.userId, organizationId: input.organizationId },
        },
        data: input.suspended
          ? { status: 'SUSPENDED', suspendedAt: at, suspendedBy: input.by }
          : { status: 'ACTIVE', suspendedAt: null, suspendedBy: null },
      });
      if (input.suspended)
        await tx.session.updateMany({
          where: { userId: input.userId, organizationId: input.organizationId, revokedAt: null },
          data: { revokedAt: at },
        });
      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          userId: input.by,
          entityType: 'organization',
          entityId: input.organizationId,
          action: input.suspended ? 'membership.suspended' : 'membership.resumed',
          before: { userId: input.userId, suspended: !input.suspended },
          after: { userId: input.userId, suspended: input.suspended },
        },
      });
      return { outcome: 'done', role };
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
  firstName: true,
  lastName: true,
  phone: true,
  position: true,
  scopes: true,
  organization: { select: { name: true } },
} as const;

/** Назначение простым объектом: в jsonb и журнал */
const plainScope = (s: { role: string; businessId: string; locationId: string | null }) => ({
  role: s.role,
  businessId: s.businessId,
  locationId: s.locationId,
});

/** Назначения из `invites.scopes` (jsonb): что не по форме, отбрасывается, а не роняет принятие */
function parseStoredScopes(raw: unknown): ScopeAssignment[] {
  if (!Array.isArray(raw)) return [];
  const out: ScopeAssignment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    if ((o.role !== 'MANAGER' && o.role !== 'STAFF') || typeof o.businessId !== 'string') continue;
    out.push({
      role: o.role,
      businessId: o.businessId,
      locationId: typeof o.locationId === 'string' ? o.locationId : null,
    });
  }
  return out;
}

function toInviteRecord(row: {
  id: string;
  organizationId: string;
  email: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
  role: MembershipRole;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  position: string | null;
  scopes: unknown;
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
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone,
    position: row.position,
    scopes: parseStoredScopes(row.scopes),
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
