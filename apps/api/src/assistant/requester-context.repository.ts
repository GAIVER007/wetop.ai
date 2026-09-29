import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import type { MembershipRole } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';

export const REQUESTER_CONTEXT_REPOSITORY = Symbol('REQUESTER_CONTEXT_REPOSITORY');

/** Что читаем о человеке и его организации (S4): названия и статусы — без пароля, телефона, гостей и денег */
export interface RequesterRows {
  user: { name: string | null; email: string };
  role: MembershipRole;
  organization: { name: string; status: string };
  businesses: Array<{
    name: string;
    vertical: string;
    status: string;
    locations: Array<{ name: string; status: string }>;
  }>;
}

export interface RequesterContextRepository {
  /** Членство (человек, организация) и то, что видно из организации. Нет членства — `null` */
  load(userId: string, organizationId: string): Promise<RequesterRows | null>;
}

@Injectable()
export class PrismaRequesterContextRepository implements RequesterContextRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async load(userId: string, organizationId: string): Promise<RequesterRows | null> {
    const db = this.prisma.db;
    const membership = await db.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      select: {
        role: true,
        user: { select: { name: true, email: true } },
        organization: { select: { name: true, status: true } },
      },
    });
    if (!membership) return null;
    const businesses = await db.business.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
      select: {
        name: true,
        vertical: true,
        status: true,
        locations: { orderBy: { createdAt: 'asc' }, select: { name: true, status: true } },
      },
    });
    return {
      user: membership.user,
      role: membership.role,
      organization: membership.organization,
      businesses,
    };
  }
}
