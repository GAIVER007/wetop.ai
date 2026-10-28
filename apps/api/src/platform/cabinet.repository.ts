import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@pms/database';
import { PrismaService } from '../database/prisma.provider';
import type { CabinetSource } from './cabinet';

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
    const [rows, records] = await Promise.all([
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
    ]);
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
      })),
      records30d: records.map((r) => ({ organizationId: r.organization_id, count: Number(r.count) })),
      ownOrganizationId: input.ownOrganizationId,
    };
  }
}
