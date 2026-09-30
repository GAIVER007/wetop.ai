import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import type { MembershipRole, OrganizationStatus } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';

export const REQUESTER_CONTEXT_REPOSITORY = Symbol('REQUESTER_CONTEXT_REPOSITORY');

/**
 * Факты об обратившемся — только то, что нужно сборке контекста (`buildRequesterContext`). Почты, телефона и имени
 * человека здесь нет вовсе: репозиторий их не читает, поэтому дальше по цепочке им неоткуда взяться.
 */
export interface RequesterFacts {
  role: MembershipRole;
  platformAdmin: boolean;
  organization: { name: string; status: OrganizationStatus; trialEndsAt: Date | null };
  businesses: Array<{ name: string; vertical: string; locations: Array<{ name: string }> }>;
}

export interface RequesterContextRepository {
  /**
   * Факты человека В ЭТОЙ организации. `null` — членства нет или человек заблокирован: чужую организацию по паре
   * «человек, организация» не прочитать, даже главному администратору (его права — раздел «Платформа», а не бот)
   */
  facts(userId: string, organizationId: string): Promise<RequesterFacts | null>;
}

// пределы — с запасом на единицу: чтобы сборка отрезала лишнее сама и знала, что оно было
const BUSINESS_TAKE = 6;
const LOCATION_TAKE = 11;

@Injectable()
export class PrismaRequesterContextRepository implements RequesterContextRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async facts(userId: string, organizationId: string): Promise<RequesterFacts | null> {
    const membership = await this.prisma.db.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      select: {
        role: true,
        user: { select: { status: true } },
        organization: { select: { name: true, status: true, trialEndsAt: true } },
      },
    });
    if (!membership || membership.user.status !== 'ACTIVE') return null;
    const [admin, businesses] = await Promise.all([
      this.prisma.db.platformAdmin.findUnique({ where: { userId }, select: { revokedAt: true } }),
      this.prisma.db.business.findMany({
        where: { organizationId, status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
        take: BUSINESS_TAKE,
        select: {
          name: true,
          vertical: true,
          locations: {
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'asc' },
            take: LOCATION_TAKE,
            select: { name: true },
          },
        },
      }),
    ]);
    return {
      role: membership.role,
      platformAdmin: admin !== null && admin.revokedAt === null,
      organization: membership.organization,
      businesses,
    };
  }
}
