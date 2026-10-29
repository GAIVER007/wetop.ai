import 'reflect-metadata';
import { Controller, Get, Header, Inject, Injectable, Query, UseInterceptors } from '@nestjs/common';
import { Prisma } from '@pms/database';
import { PrismaService } from '../database/prisma.provider';
import { ServiceDatabaseInterceptor } from '../database/service-database.interceptor';
import { currentOrganizationId } from '../auth/request-context';
import { Access } from '../auth/access.decorator';
import { requirePlatformAdmin } from './admin';
import { buildGrowth, type GrowthSource } from './growth';

export const GROWTH_REPOSITORY = Symbol('GROWTH_REPOSITORY');

export interface GrowthRepository {
  source(ownOrganizationId: string | null, since: Date): Promise<Omit<GrowthSource, 'visitors' | 'ownOrganizationId'>>;
}

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/**
 * Сырьё пути клиента и денег руководителя (срез 3). Служебной ролью базы, как весь раздел «Платформа». Регистрация
 * это учётка, которая сама завела организацию (владелец) или ещё не вошла ни в одну: приглашённые сотрудники
 * клиентов в регистрации не идут. Оплаты за всё время: LTV считается целиком. До миграции 166 денег нет: пусто.
 */
@Injectable()
export class PrismaGrowthRepository implements GrowthRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async source(_own: string | null, since: Date) {
    const db = this.prisma.db;
    const money = (await db.$queryRaw<Array<{ ok: boolean }>>(Prisma.sql`SELECT to_regclass('platform_payments') IS NOT NULL AS ok`))[0]?.ok === true;
    const [organizations, users, payments, subscriptions] = await Promise.all([
      db.organization.findMany({ select: { id: true, name: true, status: true, createdAt: true, trialEndsAt: true } }),
      db.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, memberships: { select: { role: true } } } }),
      money ? db.platformPayment.findMany() : Promise.resolve([]),
      money ? db.platformSubscription.findMany() : Promise.resolve([]),
    ]);
    return {
      organizations,
      registrations: users.filter((u) => u.memberships.length === 0 || u.memberships.some((m) => m.role === 'OWNER')).map((u) => u.createdAt),
      payments: payments.map((p) => ({ organizationId: p.organizationId, amountCents: p.amountCents, paidOn: day(p.paidOn)!, voided: p.voidedAt !== null })),
      subscriptions: subscriptions.map((s) => ({ organizationId: s.organizationId, monthlyCents: s.monthlyCents, paidUntil: day(s.paidUntil) })),
    };
  }
}

const thisMonth = () => new Date().toISOString().slice(0, 7);

/** Путь клиента месяца, MRR, LTV, клиенты с деньгами: только главному администратору (ADR-083) */
@Access('platform')
@UseInterceptors(ServiceDatabaseInterceptor)
@Controller('platform')
export class GrowthController {
  constructor(@Inject(GROWTH_REPOSITORY) private readonly repo: GrowthRepository) {}

  @Get('growth')
  @Header('Cache-Control', 'no-store')
  async growth(@Query('month') rawMonth?: string) {
    requirePlatformAdmin();
    const month = typeof rawMonth === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : thisMonth();
    const now = new Date();
    // регистрации за график: семь месяцев до выбранного
    const since = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 8, 1));
    const own = currentOrganizationId();
    const src = await this.repo.source(own, since);
    // счётчика посетителей на wetop.ai ещё нет (план, срез 2): null, экран пишет «счётчик не подключён»
    return buildGrowth({ ...src, visitors: null, ownOrganizationId: own }, month, now);
  }
}
