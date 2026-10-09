import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import type { OverviewVertical } from '@pms/domain';
import { visibleStatus } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';

/** Дерево платформы: организации, их бизнесы и действующие филиалы. Броней, гостей и счетов здесь нет по построению */
export interface TreeLocation {
  id: string;
  businessId: string;
  propertyId: string | null;
  name: string;
  address: string | null;
  currency: string;
  timezone: string;
  vertical: OverviewVertical;
}
export interface TreeOrganization {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
  owners: string[];
  businesses: Array<{ id: string; name: string; vertical: OverviewVertical }>;
  locations: TreeLocation[];
}

export interface PeriodRange {
  from: string;
  to: string;
}
export interface RawMetrics {
  locationId: string;
  month: string;
  revenueMinor: number;
  bookings: number;
  guests: number;
}

export interface AuditRow {
  id: string;
  action: string;
  after: unknown;
  createdAt: Date;
  organizationId: string | null;
  organizationName: string | null;
}

/** Действия журнала, которые попадают в «Последние действия» платформы */
export const ACTIVITY_ACTIONS = [
  'organization.created',
  'property.branch_created',
  'location.salon_created',
  'organization.status_changed',
  'extension.updated',
  'site_builder.entitlement_updated',
] as const;

@Injectable()
export class OrganizationsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async tree(): Promise<TreeOrganization[]> {
    const rows = await this.prisma.db.organization.findMany({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        status: true,
        trialEndsAt: true,
        createdAt: true,
        memberships: {
          where: { role: 'OWNER' },
          orderBy: { createdAt: 'asc' },
          select: { user: { select: { email: true } } },
        },
        businesses: {
          where: { status: 'ACTIVE' },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            name: true,
            vertical: true,
            locations: {
              where: { status: 'ACTIVE' },
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
              select: {
                id: true,
                name: true,
                address: true,
                currency: true,
                timezone: true,
                property: { select: { id: true } },
              },
            },
          },
        },
      },
    });
    const now = new Date();
    return rows.map((o) => ({
      id: o.id,
      name: o.name,
      status: visibleStatus(o.status, o.trialEndsAt, now),
      createdAt: o.createdAt,
      owners: o.memberships.map((m) => m.user.email),
      businesses: o.businesses.map((b) => ({ id: b.id, name: b.name, vertical: b.vertical })),
      locations: o.businesses.flatMap((b) =>
        b.locations.map((l) => ({
          id: l.id,
          businessId: b.id,
          propertyId: l.property?.id ?? null,
          name: l.name,
          address: l.address,
          currency: l.currency,
          timezone: l.timezone,
          vertical: b.vertical,
        })),
      ),
    }));
  }

  /**
   * Записи салона по месяцам в поясе филиала: доход (только выполненные), записи и разные клиенты (без отмен и
   * неявок). Один запрос на все филиалы и месяцы периода.
   */
  async salonMonths(locationIds: string[], range: PeriodRange): Promise<RawMetrics[]> {
    if (locationIds.length === 0) return [];
    const rows = await this.prisma.db.$queryRaw<
      Array<{ location_id: string; month: string; revenue: string; bookings: number; clients: number }>
    >`
      SELECT a.location_id,
             to_char((a.starts_at AT TIME ZONE l.timezone)::date, 'YYYY-MM') AS month,
             COALESCE(SUM(a.price) FILTER (WHERE a.status = 'DONE'), 0)::text AS revenue,
             (COUNT(*) FILTER (WHERE a.status IN ('BOOKED', 'CONFIRMED', 'DONE')))::int AS bookings,
             (COUNT(DISTINCT a.customer_id) FILTER (WHERE a.status IN ('BOOKED', 'CONFIRMED', 'DONE')))::int AS clients
        FROM appointments a
        JOIN locations l ON l.id = a.location_id
       WHERE a.location_id = ANY(${locationIds}::uuid[])
         AND (a.starts_at AT TIME ZONE l.timezone)::date BETWEEN ${range.from}::date AND ${range.to}::date
       GROUP BY 1, 2`;
    return rows.map((r) => ({
      locationId: r.location_id,
      month: r.month,
      revenueMinor: Number(r.revenue),
      bookings: r.bookings,
      guests: r.clients,
    }));
  }

  /** Брони ресторана по месяцам: число броней и гостей (сумма мест) без отмен и неявок. Денег у ресторана в модели нет */
  async restaurantMonths(locationIds: string[], range: PeriodRange): Promise<RawMetrics[]> {
    if (locationIds.length === 0) return [];
    const rows = await this.prisma.db.$queryRaw<
      Array<{ location_id: string; month: string; bookings: number; guests: number }>
    >`
      SELECT r.location_id,
             to_char((r.starts_at AT TIME ZONE l.timezone)::date, 'YYYY-MM') AS month,
             COUNT(*)::int AS bookings,
             COALESCE(SUM(r.party_size), 0)::int AS guests
        FROM restaurant_reservations r
        JOIN locations l ON l.id = r.location_id
       WHERE r.location_id = ANY(${locationIds}::uuid[])
         AND r.status IN ('BOOKED', 'CONFIRMED', 'SEATED', 'COMPLETED')
         AND (r.starts_at AT TIME ZONE l.timezone)::date BETWEEN ${range.from}::date AND ${range.to}::date
       GROUP BY 1, 2`;
    return rows.map((r) => ({
      locationId: r.location_id,
      month: r.month,
      revenueMinor: 0,
      bookings: r.bookings,
      guests: r.guests,
    }));
  }

  async activity(take: number): Promise<AuditRow[]> {
    const rows = await this.prisma.db.auditLog.findMany({
      where: { action: { in: [...ACTIVITY_ACTIONS] } },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        action: true,
        after: true,
        createdAt: true,
        organizationId: true,
        organization: { select: { name: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      after: r.after,
      createdAt: r.createdAt,
      organizationId: r.organizationId,
      organizationName: r.organization?.name ?? null,
    }));
  }
}
