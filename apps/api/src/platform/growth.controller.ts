import 'reflect-metadata';
import { Controller, Get, Header, Inject, Injectable, Query, UseInterceptors } from '@nestjs/common';
import { Prisma, type OrganizationStatus } from '@pms/database';
import { PrismaService } from '../database/prisma.provider';
import { ServiceDatabaseInterceptor } from '../database/service-database.interceptor';
import { viewerExclusion } from './company-scope';
import { currentOrganizationId } from '../auth/request-context';
import { Access } from '../auth/access.decorator';
import { requirePlatformAdmin } from './admin';
import { buildGrowth, type GrowthSource } from './growth';
import { buildSiteReport, type SiteReportInput } from './site-report';
import { buildCountries, type CountriesSource } from './countries';
import { buildRnp, type RnpSource } from './rnp';
import { buildCeoOverview, type CeoSource } from './ceo-overview';
import { buildPartners, type PartnersSource } from './partners';
import type { ExpenseCategory } from './money';

export const GROWTH_REPOSITORY = Symbol('GROWTH_REPOSITORY');

export interface GrowthRepository {
  /** ownOrganizationId в ответе: кого ещё не считать клиентом (company-scope.ts), уже с учётом записи компании */
  source(ownOrganizationId: string | null, since: Date): Promise<Omit<GrowthSource, 'visitors'>>;
  /** VTOP Overview: все оплаты и расходы компании, тарифы, подписки; партнёры, если подключены (миграция 172) */
  ceo(): Promise<{
    payments: CeoSource['payments'];
    expenses: CeoSource['expenses'];
    plans: CeoSource['plans'];
    subscriptions: CeoSource['subscriptions'];
    partners: { source: PartnersSource; created: Array<{ active: boolean; createdAt: string }> } | null;
  }>;
  /** Уникальные посетители сайта с этими адресами за [from, to); сайта со счётчиком нет: `null` */
  visitors(hosts: readonly string[], from: Date, to: Date): Promise<number | null>;
  /** Сессии, события и просмотры сайта с этими адресами за [from, to); сайта нет: `null` */
  siteActivity(hosts: readonly string[], from: Date, to: Date): Promise<Omit<SiteReportInput, 'month'> | null>;
  /** Клиенты со страной, деньги и посетители сайта по стране за [from, to) («Страны», 29.10.2026) */
  countries(hosts: readonly string[], from: Date, to: Date): Promise<Omit<CountriesSource, 'ownOrganizationId'>>;
  /** РНП по дням за [from, to): сайт, регистрации, оплаты, расходы, партнёры (30.10.2026) */
  rnp(hosts: readonly string[], from: Date, to: Date): Promise<RnpSource>;
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

  async ceo() {
    const db = this.prisma.db;
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const [payments, expenses, plans, subscriptions, ready] = await Promise.all([
      db.platformPayment.findMany({ select: { organizationId: true, amountCents: true, paidOn: true, voidedAt: true } }),
      db.platformExpense.findMany({ select: { category: true, amountCents: true, spentOn: true, voidedAt: true } }),
      db.platformPlan.findMany({ select: { id: true, name: true, priceCents: true, periodMonths: true } }),
      db.platformSubscription.findMany({ select: { organizationId: true, planId: true, monthlyCents: true, paidUntil: true } }),
      db.$queryRaw<Array<{ ok: boolean }>>(Prisma.sql`SELECT to_regclass('platform_partners') IS NOT NULL AS ok`),
    ]);
    let partners = null;
    if (ready[0]?.ok === true) {
      const [rows, links, payouts] = await Promise.all([
        db.platformPartner.findMany({ select: { id: true, name: true, phone: true, email: true, percentBp: true, active: true, createdAt: true } }),
        db.platformClientPartner.findMany({ select: { organizationId: true, partnerId: true } }),
        db.platformExpense.findMany({ where: { category: 'PARTNERS' }, select: { partnerId: true, amountCents: true, voidedAt: true } }),
      ]);
      partners = {
        source: {
          partners: rows.map((p) => ({ id: p.id, name: p.name, phone: p.phone, email: p.email, percentBp: p.percentBp, active: p.active })),
          links: links.flatMap((l) => (l.partnerId ? [{ organizationId: l.organizationId, partnerId: l.partnerId }] : [])),
          payments: payments.map((p) => ({ organizationId: p.organizationId, amountCents: p.amountCents, voided: p.voidedAt !== null })),
          payouts: payouts.flatMap((p) => (p.partnerId ? [{ partnerId: p.partnerId, amountCents: p.amountCents, voided: p.voidedAt !== null }] : [])),
        },
        created: rows.map((p) => ({ active: p.active, createdAt: iso(p.createdAt) })),
      };
    }
    return {
      payments: payments.map((p) => ({ organizationId: p.organizationId, amountCents: p.amountCents, paidOn: iso(p.paidOn), voided: p.voidedAt !== null })),
      expenses: expenses.map((e) => ({ category: e.category as ExpenseCategory, amountCents: e.amountCents, spentOn: iso(e.spentOn), voided: e.voidedAt !== null })),
      plans,
      subscriptions: subscriptions.map((s) => ({ organizationId: s.organizationId, planId: s.planId, monthlyCents: s.monthlyCents, paidUntil: s.paidUntil ? iso(s.paidUntil) : null })),
      partners,
    };
  }

  async source(own: string | null, since: Date) {
    const db = this.prisma.db;
    const money = (await db.$queryRaw<Array<{ ok: boolean }>>(Prisma.sql`SELECT to_regclass('platform_payments') IS NOT NULL AS ok`))[0]?.ok === true;
    const [all, company, users, payments, subscriptions, statusLog, activity] = await Promise.all([
      db.organization.findMany({ select: { id: true, name: true, status: true, createdAt: true, trialEndsAt: true, countryCode: true } }),
      companyOrganizationIds(db),
      db.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, memberships: { select: { role: true } } } }),
      money ? db.platformPayment.findMany() : Promise.resolve([]),
      money ? db.platformSubscription.findMany() : Promise.resolve([]),
      // отток месяца: смены статуса из журнала с начала окна
      db.auditLog.findMany({
        where: { entityType: 'organization', action: 'organization.status_changed', createdAt: { gte: since } },
        select: { entityId: true, after: true, createdAt: true },
      }),
      // дни работы в системе (главная «B», активность на пробном): действия в журнале организации и входы, по UTC
      db.$queryRaw<Array<{ organization_id: string; day: string }>>(Prisma.sql`
        SELECT organization_id::text AS organization_id, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day
          FROM audit_logs WHERE organization_id IS NOT NULL AND user_id IS NOT NULL AND created_at >= ${since}
        UNION
        SELECT organization_id::text, to_char(issued_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') FROM sessions WHERE issued_at >= ${since}
        UNION
        SELECT organization_id::text, to_char(last_seen_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') FROM sessions WHERE last_seen_at >= ${since}`),
    ]);
    // запись компании WETOP (владелец сайта wetop.ai) не клиент: ни в пути, ни в деньгах
    const organizations = all.filter((o) => !company.has(o.id));
    return {
      ownOrganizationId: viewerExclusion(company, own),
      organizations,
      registrations: users.filter((u) => u.memberships.length === 0 || u.memberships.some((m) => m.role === 'OWNER')).map((u) => u.createdAt),
      payments: payments.map((p) => ({ organizationId: p.organizationId, amountCents: p.amountCents, paidOn: day(p.paidOn)!, voided: p.voidedAt !== null })),
      subscriptions: subscriptions.map((s) => ({ organizationId: s.organizationId, monthlyCents: s.monthlyCents, paidUntil: day(s.paidUntil) })),
      activity: activity.map((r) => ({ organizationId: r.organization_id, day: r.day })),
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

  async siteActivity(hosts: readonly string[], from: Date, to: Date) {
    const db = this.prisma.db;
    const sites = await db.trackedSite.findMany({
      where: { hosts: { hasSome: [...hosts] } },
      select: { id: true, location: { select: { timezone: true } } },
    });
    if (!sites.length) return null;
    const siteId = { in: sites.map((s) => s.id) };
    const [sessions, events, pageviews] = await Promise.all([
      db.webSession.findMany({
        where: { siteId, startedAt: { gte: from, lt: to } },
        select: { visitorKey: true, sessionKey: true, startedAt: true, sourceKind: true, source: true, device: true, country: true },
      }),
      db.webEvent.findMany({
        where: { session: { siteId }, at: { gte: from, lt: to } },
        select: { name: true, session: { select: { sessionKey: true } } },
      }),
      db.webPageview.findMany({ where: { session: { siteId }, at: { gte: from, lt: to } }, select: { path: true } }),
    ]);
    return {
      // день по поясу филиала сайта; у сайта без филиала: UTC, как месяц в «Деньгах»
      timezone: sites[0]!.location?.timezone ?? 'UTC',
      sessions,
      events: events.map((e) => ({ name: e.name, sessionKey: e.session.sessionKey })),
      pageviews,
    };
  }

  async countries(hosts: readonly string[], from: Date, to: Date) {
    const db = this.prisma.db;
    const money = (await db.$queryRaw<Array<{ ok: boolean }>>(Prisma.sql`SELECT to_regclass('platform_payments') IS NOT NULL AS ok`))[0]?.ok === true;
    const [all, company, payments, subscriptions, sites] = await Promise.all([
      db.organization.findMany({ select: { id: true, countryCode: true, status: true, createdAt: true } }),
      companyOrganizationIds(db),
      money ? db.platformPayment.findMany() : Promise.resolve([]),
      money ? db.platformSubscription.findMany() : Promise.resolve([]),
      db.trackedSite.findMany({ where: { hosts: { hasSome: [...hosts] } }, select: { id: true } }),
    ]);
    // посетитель считается в стране первого визита месяца
    const visitors = sites.length
      ? (
          await db.$queryRaw<Array<{ country: string | null; n: bigint }>>(Prisma.sql`
            SELECT country, COUNT(*)::bigint AS n FROM (
              SELECT DISTINCT ON (visitor_key) visitor_key, country FROM web_sessions
              WHERE site_id IN (${Prisma.join(sites.map((x) => Prisma.sql`${x.id}::uuid`))})
                AND started_at >= ${from} AND started_at < ${to}
              ORDER BY visitor_key, started_at
            ) v GROUP BY country`)
        ).map((r) => ({ country: r.country, visitors: Number(r.n) }))
      : null;
    return {
      organizations: all.filter((o) => !company.has(o.id)),
      payments: payments.map((p) => ({ organizationId: p.organizationId, amountCents: p.amountCents, paidOn: day(p.paidOn)!, voided: p.voidedAt !== null })),
      subscriptions: subscriptions.map((x) => ({ organizationId: x.organizationId, monthlyCents: x.monthlyCents, paidUntil: day(x.paidUntil) })),
      visitors,
    };
  }

  async rnp(hosts: readonly string[], from: Date, to: Date) {
    return rnpSource(this.prisma.db, hosts, from, to);
  }
}

const tableExists = async (db: PrismaService['db'], table: string) =>
  (await db.$queryRaw<Array<{ ok: boolean }>>(Prisma.sql`SELECT to_regclass(${table}) IS NOT NULL AS ok`))[0]?.ok === true;

/** РНП: оплаты за всё время (первая оплата клиента), расходы и сайт за месяц; таблиц ещё нет: пусто */
export async function rnpSource(db: PrismaService['db'], hosts: readonly string[], from: Date, to: Date): Promise<RnpSource> {
  const [money, expenses, partnersOn] = await Promise.all([
    tableExists(db, 'platform_payments'),
    tableExists(db, 'platform_expenses'),
    tableExists(db, 'platform_partners'),
  ]);
  const [orgs, company, payments, spent, partners, links, sites] = await Promise.all([
    db.organization.findMany({ select: { id: true, createdAt: true } }),
    companyOrganizationIds(db),
    money ? db.platformPayment.findMany({ select: { organizationId: true, amountCents: true, paidOn: true, voidedAt: true } }) : Promise.resolve([]),
    expenses
      ? db.platformExpense.findMany({ where: { spentOn: { gte: from, lt: to } }, select: { amountCents: true, spentOn: true, voidedAt: true, partnerId: true } })
      : Promise.resolve([]),
    partnersOn ? db.platformPartner.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true, name: true, percentBp: true, active: true } }) : Promise.resolve([]),
    partnersOn ? db.platformClientPartner.findMany({ select: { organizationId: true, partnerId: true } }) : Promise.resolve([]),
    db.trackedSite.findMany({ where: { hosts: { hasSome: [...hosts] } }, select: { id: true } }),
  ]);
  const siteIds = sites.map((x) => x.id);
  const [sessions, sent] = siteIds.length
    ? await Promise.all([
        db.webSession.findMany({ where: { siteId: { in: siteIds }, startedAt: { gte: from, lt: to } }, select: { visitorKey: true, startedAt: true } }),
        db.webEvent.findMany({
          where: { name: 'signup_sent', session: { siteId: { in: siteIds } }, at: { gte: from, lt: to } },
          select: { at: true, session: { select: { visitorKey: true } } },
        }),
      ])
    : [[], []];
  return {
    visitors: sessions.map((x) => ({ day: day(x.startedAt)!, visitorKey: x.visitorKey })),
    leads: sent.map((e) => ({ day: day(e.at)!, visitorKey: e.session.visitorKey })),
    organizations: orgs.filter((o) => !company.has(o.id)),
    payments: payments
      .filter((p) => !company.has(p.organizationId))
      .map((p) => ({ organizationId: p.organizationId, amountCents: p.amountCents, paidOn: day(p.paidOn)!, voided: p.voidedAt !== null })),
    expenses: spent.map((e) => ({ amountCents: e.amountCents, spentOn: day(e.spentOn)!, voided: e.voidedAt !== null, partnerId: e.partnerId })),
    partners,
    links: links.flatMap((l) => (l.partnerId ? [{ organizationId: l.organizationId, partnerId: l.partnerId }] : [])),
  };
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
    return buildGrowth({ ...src, visitors }, month, now);
  }

  /** «Сайт wetop.ai» в кабинете: посетители по дням, откуда, страницы, путь к регистрации; счётчика нет: `null` */
  @Get('site')
  @Header('Cache-Control', 'no-store')
  async site(@Query('month') rawMonth?: string) {
    requirePlatformAdmin();
    const month = typeof rawMonth === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : thisMonth();
    const from = new Date(`${month}-01T00:00:00.000Z`);
    const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
    const activity = await this.repo.siteActivity(WETOP_SITE_HOSTS, from, to);
    return { month, report: activity ? buildSiteReport({ ...activity, month }) : null };
  }

  /** «Страны»: посетители, новые клиенты, платящие, доход месяца, MRR и LTV по стране */
  @Get('countries')
  @Header('Cache-Control', 'no-store')
  async countries(@Query('month') rawMonth?: string) {
    requirePlatformAdmin();
    const month = typeof rawMonth === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : thisMonth();
    const from = new Date(`${month}-01T00:00:00.000Z`);
    const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
    const src = await this.repo.countries(WETOP_SITE_HOSTS, from, to);
    return buildCountries({ ...src, ownOrganizationId: currentOrganizationId() }, month, new Date());
  }

  /**
   * VTOP Overview (ТЗ владельца 30.10.2026 «две категории админок», п. 3): Revenue, Clients, Subscriptions, Partners,
   * Finance одним ответом. Только данные компании WETOP: оплаты, расходы, подписки, тарифы, партнёры.
   */
  @Get('ceo-overview')
  @Header('Cache-Control', 'no-store')
  async ceoOverview(@Query('month') rawMonth?: string) {
    requirePlatformAdmin();
    const month = typeof rawMonth === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : thisMonth();
    const now = new Date();
    const since = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 8, 1));
    const own = currentOrganizationId();
    const [growthSrc, ceo] = await Promise.all([this.repo.source(own, since), this.repo.ceo()]);
    const growth = buildGrowth({ ...growthSrc, visitors: null }, month, now);
    const company = new Set(growthSrc.ownOrganizationId ? [growthSrc.ownOrganizationId] : []);
    const clientIds = growthSrc.organizations.filter((o) => !company.has(o.id) && o.status !== 'SUSPENDED').map((o) => o.id);
    const partners = ceo.partners ? buildPartners(ceo.partners.source) : null;
    return buildCeoOverview({
      month,
      today: now.toISOString().slice(0, 10),
      clientIds,
      payments: ceo.payments,
      expenses: ceo.expenses,
      plans: ceo.plans,
      subscriptions: ceo.subscriptions,
      kpi: growth.kpi,
      registrations: growth.funnel.registrations,
      churned: growth.churn.count,
      atRisk: growth.clients.filter((c) => c.atRisk).length,
      partners: {
        rows: ceo.partners?.created.map((p) => ({ active: p.active, createdAt: p.createdAt })) ?? [],
        totals: partners?.totals ?? { trials: 0, incomeCents: '0', accruedCents: '0', paidCents: '0', dueCents: '0' },
      },
    });
  }

  /** РНП: каждый день месяца строкой и итоги; вкладка «Партнёры» (владелец 30.10.2026) */
  @Get('rnp')
  @Header('Cache-Control', 'no-store')
  async rnp(@Query('month') rawMonth?: string) {
    requirePlatformAdmin();
    const month = typeof rawMonth === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : thisMonth();
    const from = new Date(`${month}-01T00:00:00.000Z`);
    const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
    return buildRnp(await this.repo.rnp(WETOP_SITE_HOSTS, from, to), month);
  }
}
