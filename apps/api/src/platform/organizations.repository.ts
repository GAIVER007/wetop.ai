import 'reflect-metadata';
import { ConflictException, Inject, Injectable } from '@nestjs/common';
import {
  NEW_PROPERTY_DEFAULTS,
  createBeautyLocationInChain,
  createPropertyInChain,
} from '@pms/database';
import type { OrganizationCreate, OverviewVertical } from '@pms/domain';
import { REGISTRATION_NAME_TAKEN_MESSAGE } from '@pms/domain';
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

export interface CreatedOrganization {
  organizationId: string;
  replay: boolean;
  /** Почта владельца без учётной записи: ей уходит письмо, где задаётся пароль */
  newOwner: { email: string } | null;
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

const OWNER_BLOCKED = 'Учётная запись с этой почтой заблокирована: откройте доступ на другую почту';
const NAME_TAKEN = 'Организация с таким названием уже есть';
const ID_TAKEN = 'Этот запрос уже сохранён с другими данными. Обновите страницу перед повтором.';

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
    return rows.map((o) => ({
      id: o.id,
      name: o.name,
      status: o.status,
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

  /**
   * Организация, бизнес выбранного направления, первый филиал и владелец одной транзакцией. Идентификатор запроса
   * это идентификатор организации: повтор того же запроса возвращает уже созданное, а не плодит дубль. Организация
   * начинает работать сразу (`ACTIVE`), пробного периода нет.
   */
  async create(input: OrganizationCreate, by: string | null): Promise<CreatedOrganization> {
    return this.prisma.db.$transaction(async (tx) => {
      const existing = await tx.organization.findUnique({
        where: { id: input.id },
        select: { id: true, name: true },
      });
      if (existing) {
        if (existing.name !== input.name) throw new ConflictException(ID_TAKEN);
        return { organizationId: existing.id, replay: true, newOwner: null };
      }
      const namesake = await tx.organization.findFirst({
        where: { name: { equals: input.name, mode: 'insensitive' } },
        select: { id: true },
      });
      if (namesake) throw new ConflictException(NAME_TAKEN);
      if (input.vertical === 'HOSPITALITY' && input.firstBranch) {
        const taken = await tx.property.findFirst({
          where: { name: { equals: input.firstBranch.name, mode: 'insensitive' } },
          select: { id: true },
        });
        if (taken) throw new ConflictException(REGISTRATION_NAME_TAKEN_MESSAGE);
      }
      const owner = await tx.user.findUnique({
        where: { email: input.owner.email },
        select: { id: true, status: true },
      });
      if (owner?.status === 'BLOCKED') throw new ConflictException(OWNER_BLOCKED);

      const org = await tx.organization.create({
        data: { id: input.id, name: input.name, status: 'ACTIVE', reportingCurrency: input.currency },
        select: { id: true },
      });
      const business = await tx.business.create({
        data: { organizationId: org.id, name: input.brand, vertical: input.vertical },
        select: { id: true },
      });
      const branch = input.firstBranch;
      let locationId: string | null = null;
      if (branch) {
        const data = {
          name: branch.name,
          address: branch.address || null,
          phone: input.owner.phone,
          timezone: input.timezone,
          currency: input.currency,
        };
        if (input.vertical === 'HOSPITALITY') {
          // бизнес уже заведён с публичным названием: createPropertyInChain берёт самый ранний гостиничный
          const property = await createPropertyInChain(tx, org.id, {
            ...NEW_PROPERTY_DEFAULTS,
            ...data,
          });
          locationId = property.locationId;
        } else if (input.vertical === 'BEAUTY') {
          locationId = (await createBeautyLocationInChain(tx, org.id, data)).id;
        } else {
          locationId = (await tx.location.create({ data: { businessId: business.id, ...data } })).id;
        }
      }
      const userId =
        owner?.id ??
        (
          await tx.user.create({
            data: { email: input.owner.email, name: input.owner.name, status: 'ACTIVE', passwordHash: '' },
            select: { id: true },
          })
        ).id;
      await tx.membership.create({
        data: { userId, organizationId: org.id, role: 'OWNER', phone: input.owner.phone },
      });
      await tx.auditLog.create({
        data: {
          organizationId: org.id,
          userId: by,
          entityType: 'organization',
          entityId: org.id,
          action: 'organization.created',
          // БИН и сайт в модели данных пока без колонок: до решения по DATA_MODEL они живут здесь
          after: {
            name: input.name,
            brand: input.brand,
            vertical: input.vertical,
            country: input.country,
            city: input.city,
            timezone: input.timezone,
            currency: input.currency,
            bin: input.bin,
            website: input.website,
            owner: input.owner.email,
            locationId,
          },
        },
      });
      return { organizationId: org.id, replay: false, newOwner: owner ? null : { email: input.owner.email } };
    });
  }
}
