import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@pms/database';
import { PrismaService } from '../database/prisma.provider';
import type { CabinetSource } from './cabinet';
import { companyOrganizationIds } from './growth.controller';
import { viewerExclusion } from './company-scope';

export const CABINET_REPOSITORY = Symbol('CABINET_REPOSITORY');

export interface CabinetRepository {
  source(input: { since30d: Date; ownOrganizationId: string | null }): Promise<CabinetSource>;
}

/**
 * Сырьё кабинета компании WETOP (срез 1). Читает служебной ролью базы, как весь раздел «Платформа»
 * (ServiceDatabaseInterceptor). Из рабочих таблиц клиентов берётся только счёт строк за 30 дней:
 * сами брони, гости, записи и деньги клиентов наружу не выходят.
 */
@Injectable()
export class PrismaCabinetRepository implements CabinetRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async source(input: { since30d: Date; ownOrganizationId: string | null }): Promise<CabinetSource> {
    const [all, company, records, extra] = await Promise.all([
      this.prisma.db.organization.findMany({
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          status: true,
          trialEndsAt: true,
          createdAt: true,
          businesses: {
            orderBy: { createdAt: 'asc' },
            select: { vertical: true, _count: { select: { locations: true } } },
          },
          memberships: {
            orderBy: { createdAt: 'asc' },
            select: { role: true, user: { select: { email: true, lastLoginAt: true } } },
          },
        },
      }),
      companyOrganizationIds(this.prisma.db),
      // брони гостиниц, записи салонов, брони столов ресторанов за 30 дней: только счёт по организации
      this.prisma.db.$queryRaw<Array<{ organization_id: string; count: number }>>(Prisma.sql`
        SELECT org_id::text AS organization_id, COUNT(*)::int AS count FROM (
          SELECT p.organization_id AS org_id FROM reservations r
            JOIN properties p ON p.id = r.property_id WHERE r.created_at >= ${input.since30d}
          UNION ALL
          SELECT b.organization_id FROM appointments a
            JOIN locations l ON l.id = a.location_id JOIN businesses b ON b.id = l.business_id
            WHERE a.created_at >= ${input.since30d}
          UNION ALL
          SELECT b.organization_id FROM restaurant_reservations t
            JOIN locations l ON l.id = t.location_id JOIN businesses b ON b.id = l.business_id
            WHERE t.created_at >= ${input.since30d}
        ) x GROUP BY org_id`),
      this.extra(),
    ]);
    // запись компании WETOP (владелец сайта wetop.ai) не клиент
    const rows = all.filter((o) => !company.has(o.id));
    return {
      organizations: rows.map((o) => ({
        id: o.id,
        name: o.name,
        status: o.status,
        trialEndsAt: o.trialEndsAt,
        createdAt: o.createdAt,
        verticals: [...new Set(o.businesses.map((b) => b.vertical))],
        locations: o.businesses.reduce((n, b) => n + b._count.locations, 0),
        members: o.memberships.map((m) => ({
          email: m.user.email,
          owner: m.role === 'OWNER',
          lastLoginAt: m.user.lastLoginAt,
        })),
        city: extra.cities.get(o.id) ?? null,
      })),
      subscriptions: extra.subscriptions,
      partners: extra.partners,
      records30d: records.map((r) => ({ organizationId: r.organization_id, count: Number(r.count) })),
      // запись компании есть: смотрящий не исключается, список клиентов одинаковый у всех главных администраторов
      ownOrganizationId: viewerExclusion(company, input.ownOrganizationId),
    };
  }

  /**
   * Колонки «Клиентов» по ТЗ «две админки» п. 4 (30.10.2026): город первого объекта, тариф и «оплачено до»,
   * партнёр. Таблицы денег и партнёров могут быть ещё не заведены (миграции 166, 172): тогда пусто.
   */
  private async extra() {
    const db = this.prisma.db;
    const has = async (t: string) =>
      (await db.$queryRaw<Array<{ ok: boolean }>>(Prisma.sql`SELECT to_regclass(${t}) IS NOT NULL AS ok`))[0]?.ok === true;
    const cities = new Map<string, string>();
    for (const p of await db.property.findMany({ where: { city: { not: null } }, orderBy: { createdAt: 'asc' }, select: { organizationId: true, city: true } }))
      if (p.city && !cities.has(p.organizationId)) cities.set(p.organizationId, p.city);
    const subscriptions = (await has('platform_subscriptions'))
      ? (
          await db.platformSubscription.findMany({ select: { organizationId: true, paidUntil: true, plan: { select: { name: true } } } })
        ).map((s) => ({ organizationId: s.organizationId, planName: s.plan?.name ?? null, paidUntil: s.paidUntil ? s.paidUntil.toISOString().slice(0, 10) : null }))
      : [];
    const partners = (await has('platform_partners'))
      ? (await db.platformClientPartner.findMany({ select: { organizationId: true, partner: { select: { name: true } } } })).flatMap((l) =>
          l.partner ? [{ organizationId: l.organizationId, partnerName: l.partner.name }] : [],
        )
      : [];
    return { cities, subscriptions, partners };
  }
}
