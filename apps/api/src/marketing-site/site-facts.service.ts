import { filterBeautyLocations } from '../beauty/access';
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  accessDeniedMessage,
  buildSiteFacts,
  canAt,
  effectiveService,
  hoursFromServicePeriods,
  hoursFromShifts,
  siteStatusOf,
  visibleLocations,
  type BriefVerticalFacts,
  type SiteFacts,
  type SiteFactsCatalogItem,
  type SiteFactsSnapshot,
  type SiteFactsVertical,
  type SiteLocationListItem,
} from '@pms/domain';
import type { DbTx } from '@pms/database';
import {
  currentAssignments,
  currentOrganizationId,
  currentRole,
  hasSignedInActor,
} from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';

/**
 * «Что WETOP знает о филиале» (SITE-2, `packages/domain/src/marketing/site-facts.ts`). Только чтение и только данные:
 * без ИИ, без Channex, без гостей, броней и денег за период. Работает для всех трёх направлений и для любого
 * филиала организации, к которому у человека есть право `settings` в этом месте (DATA_MODEL §31.1): так выбирают филиал
 * до того, как стойка его открыла. Филиал из параметра запроса проверяется в базе в организации вошедшего; RLS режет
 * чужое ещё раз.
 *
 * Сборщики салона и ресторана общие с брифом генерации (`readVerticalFacts`): один и тот же каталог с теми же ценами
 * уходит и в карточку филиала, и в бриф.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clock = (d: Date) => d.toISOString().slice(11, 16);
const byCode = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export const FACTS_PERMISSION = 'settings' as const;
export const FACTS_LOCATION_NOT_FOUND = 'Филиал не найден';

export interface SiteFactsTarget {
  organizationId: string;
  businessId: string;
  locationId: string;
  vertical: SiteFactsVertical;
}

type ReadDb = Pick<
  DbTx,
  | 'location'
  | 'property'
  | 'accommodationType'
  | 'beautyService'
  | 'employee'
  | 'workingHours'
  | 'menuCategory'
  | 'servicePeriod'
  | 'restaurantOrderRating'
  | 'siteAsset'
  | 'menuItemPhoto'
>;

/** Салон: услуги филиала с действующими ценой и длительностью, мастера филиала и их смены */
export async function readBeautyFacts(db: ReadDb, businessId: string, locationId: string, currency: string) {
  const services = await db.beautyService.findMany({
    where: { businessId, active: true },
    select: {
      id: true,
      name: true,
      category: true,
      durationMinutes: true,
      price: true,
      currency: true,
      active: true,
      locations: { where: { locationId }, select: { enabled: true, priceOverride: true, durationOverride: true } },
    },
  });
  const sellable = services.flatMap((s) => {
    const own = s.locations[0];
    const eff = effectiveService({
      service: { active: s.active, priceMinor: s.price, currency: s.currency, durationMinutes: s.durationMinutes },
      locationCurrency: currency,
      locationService: own
        ? { enabled: own.enabled, priceOverrideMinor: own.priceOverride, durationOverrideMinutes: own.durationOverride }
        : null,
    });
    if (!eff.sellable || eff.priceMinor < 0n || !Number.isInteger(eff.durationMinutes) || eff.durationMinutes <= 0) return [];
    return [{ id: s.id, name: s.name, category: s.category, durationMin: eff.durationMinutes, priceMinor: eff.priceMinor.toString(), currency: eff.currency }];
  });
  const serviceName = new Map(sellable.map((s) => [s.id, s.name]));
  const employees = await db.employee.findMany({
    where: { businessId, status: 'ACTIVE', locations: { some: { locationId } } },
    select: { id: true, name: true, services: { select: { serviceId: true } } },
  });
  const staff = employees.map((e) => {
    const names = e.services.map((s) => serviceName.get(s.serviceId)).filter((n): n is string => !!n).sort(byCode);
    return { id: e.id, name: e.name, specialization: names.length ? names.join(', ') : null };
  });
  const shifts = await db.workingHours.findMany({
    where: { locationId, employee: { businessId, status: 'ACTIVE', locations: { some: { locationId } } } },
    select: { weekday: true, timeFrom: true, timeTo: true },
  });
  const hours = hoursFromShifts(shifts.map((h) => ({ weekday: h.weekday, timeFrom: clock(h.timeFrom), timeTo: clock(h.timeTo) })));
  return { services: sellable, staff, hours };
}

/** Ресторан: меню бизнеса в порядке ресторана (только «в меню»), сервис-периоды филиала и оценки заказов филиала */
export async function readFoodFacts(db: ReadDb, businessId: string, locationId: string) {
  const categories = await db.menuCategory.findMany({
    where: { businessId, active: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    select: {
      name: true,
      items: {
        where: { active: true, businessId },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        select: { id: true, name: true, weightGrams: true, price: true, currency: true, photo: { select: { menuItemId: true } } },
      },
    },
  });
  const menu = categories
    .map((c) => ({
      title: c.name,
      items: c.items.map((i) => ({
        code: i.id,
        name: i.name,
        weightGrams: i.weightGrams,
        priceMinor: i.price.toString(),
        currency: i.currency,
        hasPhoto: !!i.photo,
      })),
    }))
    .filter((c) => c.items.length > 0);
  const periods = await db.servicePeriod.findMany({
    where: { locationId, active: true },
    select: { weekday: true, timeFrom: true, timeTo: true, endsNextDay: true },
  });
  const hours = hoursFromServicePeriods(
    periods.map((p) => ({ weekday: p.weekday, timeFrom: clock(p.timeFrom), timeTo: clock(p.timeTo), endsNextDay: p.endsNextDay })),
  );
  const rating = await db.restaurantOrderRating.aggregate({
    where: { order: { locationId } },
    _avg: { stars: true },
    _count: { _all: true },
  });
  const reviews = rating._count._all > 0 && rating._avg.stars !== null ? { avg: rating._avg.stars, count: rating._count._all } : null;
  return { menu, hours, reviews };
}

/** Бриф генерации (SITE-2): факты салона или ресторана тем же сборщиком, что карточка филиала */
export async function readVerticalFacts(
  db: ReadDb,
  vertical: 'BEAUTY' | 'FOOD_SERVICE',
  businessId: string,
  locationId: string,
  currency: string,
): Promise<BriefVerticalFacts> {
  if (vertical === 'BEAUTY') {
    const b = await readBeautyFacts(db, businessId, locationId, currency);
    return {
      vertical,
      services: b.services.map((s) => ({ code: s.id, name: s.name, category: s.category, durationMin: s.durationMin, priceMinor: s.priceMinor, currency: s.currency })),
      staff: b.staff,
      menu: [],
      hours: b.hours,
    };
  }
  const f = await readFoodFacts(db, businessId, locationId);
  return { vertical, services: [], staff: [], menu: f.menu, hours: f.hours };
}

/** Снимок фактов филиала целиком, в одной транзакции чтения */
export async function readSiteFactsSnapshot(db: ReadDb, target: SiteFactsTarget): Promise<SiteFactsSnapshot> {
  const location = await db.location.findFirstOrThrow({
    where: { id: target.locationId, businessId: target.businessId },
    select: { id: true, name: true, address: true, phone: true, currency: true },
  });
  const photos = await db.siteAsset.count({ where: { locationId: target.locationId, status: 'READY', deletedAt: null } });
  const base = {
    vertical: target.vertical,
    location: { id: location.id, name: location.name, address: location.address, phone: location.phone, whatsapp: null, city: null as string | null },
    staff: [] as SiteFactsSnapshot['staff'],
    hours: { days: [] as SiteFactsSnapshot['hours']['days'], checkInTime: null as string | null, checkOutTime: null as string | null },
    photosCount: photos,
    reviews: null as SiteFactsSnapshot['reviews'],
  };
  if (target.vertical === 'HOSPITALITY') {
    const property = await db.property.findFirst({
      where: { locationId: target.locationId, organizationId: target.organizationId },
      select: { id: true, address: true, city: true, checkInTime: true, checkOutTime: true },
    });
    const types = property
      ? await db.accommodationType.findMany({
          where: { propertyId: property.id, active: true },
          orderBy: [{ code: 'asc' }],
          select: { code: true, name: true, capacityAdults: true },
        })
      : [];
    return {
      ...base,
      location: { ...base.location, address: base.location.address ?? property?.address ?? null, city: property?.city ?? null },
      catalog: { kind: 'rooms', items: types.map((t) => ({ code: t.code, name: t.name, capacityAdults: t.capacityAdults })) },
      hours: { days: [], checkInTime: property?.checkInTime ?? null, checkOutTime: property?.checkOutTime ?? null },
    };
  }
  if (target.vertical === 'BEAUTY') {
    const b = await readBeautyFacts(db, target.businessId, target.locationId, location.currency);
    const items: SiteFactsCatalogItem[] = [...b.services]
      .sort((x, y) => byCode(x.category ?? '', y.category ?? '') || byCode(x.name, y.name) || byCode(x.id, y.id))
      .map((s) => ({
        code: s.id,
        name: s.name,
        price: { minor: s.priceMinor, currency: s.currency },
        durationMin: s.durationMin,
        ...(s.category ? { category: s.category } : {}),
      }));
    return { ...base, catalog: { kind: 'services', items }, staff: b.staff, hours: { ...base.hours, days: b.hours } };
  }
  const f = await readFoodFacts(db, target.businessId, target.locationId);
  const items: SiteFactsCatalogItem[] = f.menu.flatMap((c) =>
    c.items.map((i) => ({
      code: i.code,
      name: i.name,
      price: { minor: i.priceMinor, currency: i.currency },
      category: c.title,
      ...(i.weightGrams ? { weightGrams: i.weightGrams } : {}),
      hasPhoto: i.hasPhoto,
    })),
  );
  const dishPhotos = items.filter((i) => i.hasPhoto).length;
  return {
    ...base,
    catalog: { kind: 'menu', items },
    hours: { ...base.hours, days: f.hours },
    photosCount: photos + dishPhotos,
    reviews: f.reviews,
  };
}

@Injectable()
export class SiteFactsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Филиал из параметра: свой организации, действующий, в действующем бизнесе; право `settings` у человека в этом
   * месте (с областью доступа роль места, без неё роль организации). Чужой и несуществующий неотличимы: 404
   */
  async target(raw: unknown): Promise<SiteFactsTarget> {
    const organizationId = currentOrganizationId();
    if (!hasSignedInActor() || !organizationId) throw new ForbiddenException('Войдите в организацию');
    if (typeof raw !== 'string' || !UUID.test(raw)) throw new BadRequestException('locationId: идентификатор филиала');
    const row = await this.prisma.db.location.findFirst({
      where: { id: raw, status: 'ACTIVE', business: { organizationId, status: 'ACTIVE' } },
      select: { id: true, businessId: true, business: { select: { vertical: true } } },
    });
    if (!row) throw new NotFoundException(FACTS_LOCATION_NOT_FOUND);
    if (!(await filterBeautyLocations(this.prisma.db,[{id:row.id,businessId:row.businessId,vertical:row.business.vertical}],{section:'settings',action:'view'})).length) throw new NotFoundException(FACTS_LOCATION_NOT_FOUND);
    const role = currentRole() ?? 'STAFF';
    if (!canAt(role, currentAssignments(), FACTS_PERMISSION, { businessId: row.businessId, locationId: row.id }))
      throw new ForbiddenException(accessDeniedMessage(FACTS_PERMISSION));
    return { organizationId, businessId: row.businessId, locationId: row.id, vertical: row.business.vertical as SiteFactsVertical };
  }

  async facts(locationId: unknown): Promise<SiteFacts> {
    const target = await this.target(locationId);
    const snapshot = await this.prisma.db.$transaction((tx) => readSiteFactsSnapshot(tx, target));
    return buildSiteFacts(snapshot);
  }

  /** Филиалы организации, где человек может вести сайт, со статусом сайта; порядок как в выборе филиала */
  async locations(): Promise<{ items: SiteLocationListItem[] }> {
    const organizationId = currentOrganizationId();
    if (!hasSignedInActor() || !organizationId) throw new ForbiddenException('Войдите в организацию');
    const rows = await this.prisma.db.location.findMany({
      where: { status: 'ACTIVE', business: { organizationId, status: 'ACTIVE' } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, businessId: true, business: { select: { vertical: true } }, marketingSite: { select: { state: true } } },
    });
    const role = currentRole() ?? 'STAFF';
    const assignments = currentAssignments();
    const visible = new Set(visibleLocations(role, assignments, rows).map((r) => r.id));
    const permitted = new Set((await filterBeautyLocations(this.prisma.db, rows.map(row=>({id:row.id,businessId:row.businessId,vertical:row.business.vertical})),{section:'settings',action:'view'})).map(row=>row.id));
    const items = rows
      .filter((r) => permitted.has(r.id) && visible.has(r.id) && canAt(role, assignments, FACTS_PERMISSION, { businessId: r.businessId, locationId: r.id }))
      .map((r) => ({
        id: r.id,
        name: r.name,
        vertical: r.business.vertical as SiteFactsVertical,
        siteStatus: siteStatusOf(r.marketingSite?.state ?? null),
      }));
    return { items };
  }
}
