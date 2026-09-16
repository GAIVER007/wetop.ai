import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import type {
  AccountRecord,
  AccountsRepository,
  LoginCodeRecord,
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
    return this.prisma.loginCode.count({ where: { email, createdAt: { gte: since } } });
  }

  async codesForIpSince(ip: string, since: Date): Promise<number> {
    return this.prisma.loginCode.count({ where: { requestedIp: ip, createdAt: { gte: since } } });
  }

  async saveLoginCode(input: {
    email: string;
    codeHash: string;
    expiresAt: Date;
    ip: string | null;
  }): Promise<void> {
    await this.prisma.loginCode.create({
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
    const row = await this.prisma.loginCode.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
      select: { id: true, codeHash: true, expiresAt: true, attempts: true, usedAt: true },
    });
    return row ?? null;
  }

  async markCodeAttempt(id: string): Promise<void> {
    await this.prisma.loginCode.update({ where: { id }, data: { attempts: { increment: 1 } } });
  }

  async markCodeUsed(id: string, at: Date): Promise<void> {
    await this.prisma.loginCode.update({ where: { id }, data: { usedAt: at } });
  }

  /**
   * Пользователь и его организация. Организаций у человека может быть несколько (приглашения,
   * этап 7); пока берём первую по времени вступления — выбор организации будет отдельным шагом.
   */
  async accountByEmail(email: string): Promise<AccountRecord | null> {
    const user = await this.prisma.user.findUnique({
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

  async markLogin(userId: string, at: Date): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { lastLoginAt: at } });
  }

  async createSession(input: {
    tokenHash: string;
    userId: string;
    organizationId: string;
    expiresAt: Date;
    userAgent: string | null;
  }): Promise<void> {
    await this.prisma.session.create({
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
    const row = await this.prisma.session.findUnique({
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
    await this.prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: at },
    });
  }
}
