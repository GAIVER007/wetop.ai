import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import { siteBuilderAccess, type ExtensionChange } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';

/**
 * Лицензии конструктора сайта по филиалам (MKT9.2, DATA_MODEL §29.12) глазами главного администратора платформы:
 * гостиничные филиалы организации, есть ли сайт, статус и срок лицензии. Выдаёт, продлевает и выключает только он
 * (служебная роль базы, приложение лицензию не пишет по правам). Строки не удаляются: выключение это OFF.
 */
const LOCATION_SELECT = {
  id: true,
  name: true,
  status: true,
  business: { select: { name: true } },
  marketingSite: { select: { state: true, slug: true } },
  siteBuilderEntitlement: { select: { status: true, activeUntil: true, note: true, updatedAt: true } },
} as const;

type LocationRow = {
  id: string;
  name: string;
  status: string;
  business: { name: string };
  marketingSite: { state: string; slug: string } | null;
  siteBuilderEntitlement: { status: 'TRIAL' | 'ACTIVE' | 'OFF'; activeUntil: Date | null; note: string | null; updatedAt: Date } | null;
};

export function licenseLocationView(row: LocationRow, now: Date) {
  const e = row.siteBuilderEntitlement;
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    businessName: row.business.name,
    site: row.marketingSite ? { state: row.marketingSite.state, slug: row.marketingSite.slug } : null,
    license: {
      access: siteBuilderAccess(e, now),
      status: e?.status ?? null,
      activeUntil: e?.activeUntil?.toISOString() ?? null,
      note: e?.note ?? null,
      updatedAt: e?.updatedAt.toISOString() ?? null,
    },
  };
}

@Injectable()
export class SiteBuilderLicenses {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Гостиничные филиалы организации (действующие и архивные) по порядку заведения */
  async locations(organizationId: string) {
    return this.prisma.db.location.findMany({
      where: { business: { organizationId, vertical: 'HOSPITALITY' } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: LOCATION_SELECT,
    });
  }

  async location(organizationId: string, locationId: string) {
    return this.prisma.db.location.findFirst({
      where: { id: locationId, business: { organizationId, vertical: 'HOSPITALITY' } },
      select: LOCATION_SELECT,
    });
  }

  /** Изменение и строка журнала одной транзакцией: без записи в журнале лицензия не меняется */
  async save(input: { organizationId: string; locationId: string; change: ExtensionChange; by: string | null; now: Date }): Promise<void> {
    await this.prisma.db.$transaction(async (tx) => {
      const before = await tx.siteBuilderEntitlement.findUnique({
        where: { locationId: input.locationId },
        select: { status: true, activeUntil: true, note: true },
      });
      const data = { ...input.change, updatedAt: input.now, updatedBy: input.by };
      await tx.siteBuilderEntitlement.upsert({
        where: { locationId: input.locationId },
        create: { locationId: input.locationId, ...data },
        update: data,
      });
      const trace = (r: { status: string; activeUntil: Date | null; note: string | null }) => ({
        status: r.status,
        activeUntil: r.activeUntil?.toISOString() ?? null,
        note: r.note,
      });
      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          userId: input.by,
          entityType: 'location',
          entityId: input.locationId,
          action: 'site_builder.entitlement_updated',
          ...(before ? { before: trace(before) } : {}),
          after: trace(input.change),
        },
      });
    });
  }
}
