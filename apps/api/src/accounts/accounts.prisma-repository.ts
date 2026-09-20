import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import type {
  AccountRecord,
  AccountsRepository,
  InviteRecord,
  LoginCodeRecord,
  SessionListRecord,
  SessionRecord,
} from './accounts.repository';

/**
 * Учётные записи в базе (DATA_MODEL §13). Ни кодов, ни ключей сессий здесь нет — только их
 * отпечатки: они приходят сюда уже посчитанными.
 */
@Injectable()
export class PrismaAccountsRepository implements AccountsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async codesForEmailSince(email: string, since: Date): Promise<number> {
    return this.prisma.db.loginCode.count({ where: { email, createdAt: { gte: since } } });
  }

  async codesForIpSince(ip: string, since: Date): Promise<number> {
    return this.prisma.db.loginCode.count({
      where: { requestedIp: ip, createdAt: { gte: since } },
    });
  }

  async saveLoginCode(input: {
    email: string;
    codeHash: string;
    expiresAt: Date;
    ip: string | null;
  }): Promise<void> {
    await this.prisma.db.loginCode.create({
      data: {
        email: input.email,
        codeHash: input.codeHash,
        expiresAt: input.expiresAt,
        requestedIp: input.ip,
      },
    });
  }

  /** Последний по времени. Старые не удаляем: по ним считаются часовые пределы. */
  async latestLoginCode(email: string): Promise<LoginCodeRecord | null> {
    const row = await this.prisma.db.loginCode.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
      select: { id: true, codeHash: true, expiresAt: true, attempts: true, usedAt: true },
    });
    return row ?? null;
  }

  async markCodeAttempt(id: string): Promise<void> {
    await this.prisma.db.loginCode.update({ where: { id }, data: { attempts: { increment: 1 } } });
  }

  async markCodeUsed(id: string, at: Date): Promise<void> {
    await this.prisma.db.loginCode.update({ where: { id }, data: { usedAt: at } });
  }

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
            organization: {
              select: { id: true, name: true, status: true, trialEndsAt: true },
            },
          },
        },
      },
    });
    if (!user || user.status !== 'ACTIVE') return null;
    const org = user.memberships[0]?.organization;
    if (!org) return null;
    return {
      userId: user.id,
      email: user.email,
      organizationId: org.id,
      organizationName: org.name,
      organizationStatus: org.status,
      trialEndsAt: org.trialEndsAt,
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
        await tx.membership.create({ data: { userId: user.id, organizationId: org.id } });
        return {
          userId: user.id,
          email: user.email,
          organizationId: org.id,
          organizationName: org.name,
          organizationStatus: org.status,
          trialEndsAt: org.trialEndsAt,
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

  async createSession(input: {
    tokenHash: string;
    userId: string;
    organizationId: string;
    expiresAt: Date;
    userAgent: string | null;
  }): Promise<void> {
    await this.prisma.db.session.create({
      data: {
        tokenHash: input.tokenHash,
        userId: input.userId,
        organizationId: input.organizationId,
        expiresAt: input.expiresAt,
        userAgent: input.userAgent?.slice(0, 400) ?? null,
      },
    });
  }

  async sessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const row = await this.prisma.db.session.findUnique({
      where: { tokenHash },
      select: {
        expiresAt: true,
        revokedAt: true,
        user: { select: { id: true, email: true } },
        organization: { select: { id: true, name: true, status: true, trialEndsAt: true } },
      },
    });
    if (!row) return null;
    return {
      userId: row.user.id,
      email: row.user.email,
      organizationId: row.organization.id,
      organizationName: row.organization.name,
      organizationStatus: row.organization.status,
      trialEndsAt: row.organization.trialEndsAt,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
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
  }): Promise<InviteRecord> {
    const row = await this.prisma.db.invite.create({
      data: {
        organizationId: input.organizationId,
        email: input.email,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        createdBy: input.createdBy,
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
  async joinOrganization(input: { email: string; organizationId: string }): Promise<AccountRecord> {
    return this.prisma.db.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { email: input.email },
        create: { email: input.email, status: 'ACTIVE' },
        update: {},
        select: { id: true, email: true },
      });
      await tx.membership.upsert({
        where: { userId_organizationId: { userId: user.id, organizationId: input.organizationId } },
        create: { userId: user.id, organizationId: input.organizationId },
        update: {},
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
      };
    });
  }
}

const INVITE_SELECT = {
  id: true,
  organizationId: true,
  email: true,
  expiresAt: true,
  acceptedAt: true,
  createdAt: true,
  organization: { select: { name: true } },
} as const;

function toInviteRecord(row: {
  id: string;
  organizationId: string;
  email: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
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
  };
}

/** Код P2002 у Prisma — нарушение уникального индекса. Другие ошибки базы не глотаем. */
function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'P2002';
}
