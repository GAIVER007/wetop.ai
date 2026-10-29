import 'reflect-metadata';
import { Controller, Get, Header, Inject, Injectable, Query, UseInterceptors } from '@nestjs/common';
import { Prisma, type OrganizationStatus } from '@pms/database';
import { PrismaService } from '../database/prisma.provider';
import { ServiceDatabaseInterceptor } from '../database/service-database.interceptor';
import { currentOrganizationId } from '../auth/request-context';
import { Access } from '../auth/access.decorator';
import { requirePlatformAdmin } from './admin';
import { buildGrowth, type GrowthSource } from './growth';

export const GROWTH_REPOSITORY = Symbol('GROWTH_REPOSITORY');

export interface GrowthRepository {
  source(ownOrganizationId: string | null, since: Date): Promise<Omit<GrowthSource, 'visitors' | 'ownOrganizationId'>>;
  /** Уникальные посетители сайта с этими адресами за [from, to); сайта со счётчиком нет: `null` */
  visitors(hosts: readonly string[], from: Date, to: Date): Promise<number | null>;
}

/**
 * Свой сайт компании: счётчик WETOP (`/a/pms.js`) стоит на wetop.ai с ключом сайта, у которого эти адреса
 * (запись в `tracked_sites` своей организации, скрипт `workspace-cleanup-control/wetop-site-counter.sql`).
 */
export const WETOP_SITE_HOSTS: readonly string[] = ['wetop.ai', 'www.wetop.ai'];

/** Организации, которым принадлежит сайт wetop.ai: это сама компания WETOP, а не клиент */
export async function companyOrganizationIds(db: PrismaService['db']): Promise<Set<string>> {
  const rows = await db.trackedSite.findMany({
    where: { hosts: { hasSome: [...WETOP_SITE_HOSTS] } },
    select: { location: { select: { business: { select: { organizationId: true } } } } },
  });
  return new Set(rows.flatMap((r) => (r.location ? [r.location.business.organizationId] : [])));
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
    const [all, company, users, payments, subscriptions, statusLog] = await Promise.all([
      db.organization.findMany({ select: { id: true, name: true, status: true, createdAt: true, trialEndsAt: true } }),
      companyOrganizationIds(db),
      db.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, memberships: { select: { role: true } } } }),
      money ? db.platformPayment.findMany() : Promise.resolve([]),
      money ? db.platformSubscription.findMany() : Promise.resolve([]),
      // отток месяца: смены статуса из журнала с начала окна
      db.auditLog.findMany({
        where: { entityType: 'organization', action: 'organization.status_changed', createdAt: { gte: since } },
        select: { entityId: true, after: true, createdAt: true },
      }),
    ]);
    // запись компании WETOP (владелец сайта wetop.ai) не клиент: ни в пути, ни в деньгах
    const organizations = all.filter((o) => !company.has(o.id));
    return {
      organizations,
      registrations: users.filter((u) => u.memberships.length === 0 || u.memberships.some((m) => m.role === 'OWNER')).map((u) => u.createdAt),
      payments: payments.map((p) => ({ organizationId: p.organizationId, amountCents: p.amountCents, paidOn: day(p.paidOn)!, voided: p.voidedAt !== null })),
      subscriptions: subscriptions.map((s) => ({ organizationId: s.organizationId, monthlyCents: s.monthlyCents, paidUntil: day(s.paidUntil) })),
      statusChanges: statusLog.flatMap((r) => {
        const to = (r.after && typeof r.after === 'object' ? (r.after as Record<string, unknown>)['status'] : null) as OrganizationStatus | null;
        return to ? [{ organizationId: r.entityId, to, at: r.createdAt }] : [];
      }),
    };
  }

  async visitors(hosts: readonly string[], from: Date, to: Date): Promise<number | null> {
    const db = this.prisma.db;
    const sites = await db.trackedSite.findMany({ where: { hosts: { hasSome: [...hosts] } }, select: { id: true } });
    if (!sites.length) return null;
    const rows = await db.$queryRaw<Array<{ n: number }>>(Prisma.sql`
      SELECT COUNT(DISTINCT visitor_key)::int AS n FROM web_sessions
      WHERE site_id IN (${Prisma.join(sites.map((s) => Prisma.sql`${s.id}::uuid`))})
        AND started_at >= ${from} AND started_at < ${to}`);
    return Number(rows[0]?.n ?? 0);
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
    const from = new Date(`${month}-01T00:00:00.000Z`);
    const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
    // посетители wetop.ai: счётчик WETOP на своём сайте; пока сайт не заведён, null и «счётчик не подключён»
    const [src, visitors] = await Promise.all([this.repo.source(own, since), this.repo.visitors(WETOP_SITE_HOSTS, from, to)]);
    return buildGrowth({ ...src, visitors, ownOrganizationId: own }, month, now);
  }
}
