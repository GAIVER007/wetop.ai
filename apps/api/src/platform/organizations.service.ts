import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import {
  EMPTY_METRICS,
  PLATFORM_TIMEZONE,
  activityLabel,
  lastMonths,
  platformMonthPeriod,
  todayAt,
  type BranchMetrics,
  type OverviewActivity,
  type OverviewBranch,
  type OverviewOrganization,
  type OverviewSeriesPoint,
  type PlatformOverview,
} from '@pms/domain';
import { withPlatformReport } from '../auth/request-context';
import { requirePlatformAdmin } from './admin';
import { DashboardService } from '../dashboard/dashboard.service';
import {
  OrganizationsRepository,
  type RawMetrics,
  type TreeLocation,
  type TreeOrganization,
} from './organizations.repository';

/** Месяцев в ряду диаграммы «Динамика по всем филиалам» */
export const SERIES_MONTHS = 6;
const ACTIVITY_SHOWN = 8;
const NEW_WINDOW_DAYS = 30;

/** Прошедшие месяцы не меняются задним числом заметно: держим минуту у текущего и десять минут у прошедших */
const CURRENT_TTL_MS = 60_000;
const PAST_TTL_MS = 10 * 60_000;
const cache = new Map<string, { at: number; value: unknown }>();
/** Для тестов: кэш живёт в памяти процесса */
export const clearOrganizationsCache = (): void => cache.clear();
async function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

const num = (v: string | number | null | undefined): number => (v === null || v === undefined ? 0 : Number(v));

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(OrganizationsRepository) private readonly repo: OrganizationsRepository,
    @Inject(DashboardService) private readonly dashboard: DashboardService,
  ) {}

  async overview(month: string | undefined, now = new Date()): Promise<PlatformOverview> {
    requirePlatformAdmin();
    const today = todayAt(PLATFORM_TIMEZONE, now);
    const period = platformMonthPeriod(month ?? today.slice(0, 7), today);
    const tree = await this.repo.tree();
    const byLocation = await this.metrics(tree, period);
    const organizations: OverviewOrganization[] = tree.map((o) => this.organization(o, byLocation));
    const since = now.getTime() - NEW_WINDOW_DAYS * 86_400_000;
    return {
      period,
      organizations,
      series: [],
      activity: await this.activity(),
      newOrganizations: tree.filter((o) => o.createdAt.getTime() >= since).length,
    };
  }

  /** Помесячный ряд по всем филиалам: доход по валютам, загрузка (числитель и знаменатель), гости */
  async series(month: string | undefined, now = new Date()): Promise<OverviewSeriesPoint[]> {
    requirePlatformAdmin();
    const today = todayAt(PLATFORM_TIMEZONE, now);
    const current = (month ?? today.slice(0, 7)).slice(0, 7);
    const months = lastMonths(current, SERIES_MONTHS);
    const tree = await this.repo.tree();
    const locations = tree.flatMap((o) => o.locations);
    const first = platformMonthPeriod(months[0]!, today).from;
    const last = platformMonthPeriod(current, today).to;
    const [salon, restaurant] = await Promise.all([
      this.repo.salonMonths(ids(locations, 'BEAUTY'), { from: first, to: last }),
      this.repo.restaurantMonths(ids(locations, 'FOOD_SERVICE'), { from: first, to: last }),
    ]);
    const currencyOf = new Map(locations.map((l) => [l.id, l.currency]));
    const points = new Map<string, OverviewSeriesPoint>(
      months.map((m) => [m, { month: m, revenue: {}, occupiedNights: 0, unitNights: 0, guests: 0 }]),
    );
    for (const row of [...salon, ...restaurant]) {
      const point = points.get(row.month);
      if (!point) continue;
      const currency = currencyOf.get(row.locationId) ?? 'KZT';
      if (row.revenueMinor) point.revenue[currency] = (point.revenue[currency] ?? 0) + row.revenueMinor;
      point.guests += row.guests;
    }
    for (const m of months) {
      const period = platformMonthPeriod(m, today);
      const hotels = locations.filter((l) => l.vertical === 'HOSPITALITY' && l.propertyId);
      const ttl = m === current ? CURRENT_TTL_MS : PAST_TTL_MS;
      const point = points.get(m)!;
      for (const hotel of hotels) {
        const owner = tree.find((o) => o.locations.includes(hotel))!;
        const key = `hotel:${hotel.id}:${period.from}:${period.to}`;
        const metrics = await cached(key, ttl, () => this.hotelMetrics(owner.id, hotel, period));
        if (metrics.metrics.revenueMinor !== null)
          point.revenue[hotel.currency] = (point.revenue[hotel.currency] ?? 0) + metrics.metrics.revenueMinor;
        point.occupiedNights += metrics.metrics.occupiedNights ?? 0;
        point.unitNights += metrics.metrics.unitNights ?? 0;
        point.guests += metrics.metrics.guests ?? 0;
      }
    }
    return [...points.values()];
  }

  private organization(o: TreeOrganization, byLocation: Map<string, { now: BranchMetrics; before: BranchMetrics }>): OverviewOrganization {
    return {
      id: o.id,
      name: o.name,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
      owners: o.owners,
      businesses: o.businesses,
      branches: o.locations.map(
        (l): OverviewBranch => ({
          id: l.id,
          name: l.name,
          address: l.address,
          currency: l.currency,
          timezone: l.timezone,
          vertical: l.vertical,
          businessId: l.businessId,
          metrics: byLocation.get(l.id)?.now ?? EMPTY_METRICS,
          previous: byLocation.get(l.id)?.before ?? EMPTY_METRICS,
        }),
      ),
    };
  }

  /** Цифры филиалов за период и за равный ему предыдущий: гостиница отчётом объекта, салон и ресторан выборками */
  private async metrics(
    tree: TreeOrganization[],
    period: PlatformOverview['period'],
  ): Promise<Map<string, { now: BranchMetrics; before: BranchMetrics }>> {
    const locations = tree.flatMap((o) => o.locations);
    const out = new Map<string, { now: BranchMetrics; before: BranchMetrics }>();
    const current = { from: period.from, to: period.to };
    const previous = { from: period.previousFrom, to: period.previousTo };
    const [salonNow, restaurantNow, salonBefore, restaurantBefore] = await Promise.all([
      this.repo.salonMonths(ids(locations, 'BEAUTY'), current),
      this.repo.restaurantMonths(ids(locations, 'FOOD_SERVICE'), current),
      this.repo.salonMonths(ids(locations, 'BEAUTY'), previous),
      this.repo.restaurantMonths(ids(locations, 'FOOD_SERVICE'), previous),
    ]);
    const fold = (rows: RawMetrics[], locationId: string, money: boolean): BranchMetrics => {
      const mine = rows.filter((r) => r.locationId === locationId);
      return {
        // у ресторана денег в модели нет: «нет данных», не ноль
        revenueMinor: money ? mine.reduce((a, r) => a + r.revenueMinor, 0) : null,
        occupiedNights: null,
        unitNights: null,
        guests: mine.reduce((a, r) => a + r.guests, 0),
        bookings: mine.reduce((a, r) => a + r.bookings, 0),
      };
    };
    for (const l of locations) {
      if (l.vertical === 'BEAUTY')
        out.set(l.id, { now: fold(salonNow, l.id, true), before: fold(salonBefore, l.id, true) });
      else if (l.vertical === 'FOOD_SERVICE')
        out.set(l.id, { now: fold(restaurantNow, l.id, false), before: fold(restaurantBefore, l.id, false) });
    }
    // Гостиницы по одной: пул соединений API маленький, а отчёт объекта сам ходит в базу несколькими запросами
    for (const organization of tree) {
      for (const l of organization.locations.filter((x) => x.vertical === 'HOSPITALITY' && x.propertyId)) {
        const ttl = period.month === todayAt(PLATFORM_TIMEZONE).slice(0, 7) ? CURRENT_TTL_MS : PAST_TTL_MS;
        const hotel = await cached(`hotel:${l.id}:${period.from}:${period.to}`, ttl, () =>
          this.hotelMetrics(organization.id, l, current),
        );
        out.set(l.id, { now: hotel.metrics, before: hotel.previous });
      }
    }
    return out;
  }

  private async hotelMetrics(
    organizationId: string,
    l: TreeLocation,
    period: { from: string; to: string },
  ): Promise<{ metrics: BranchMetrics; previous: BranchMetrics }> {
    const view = await withPlatformReport(organizationId, l.businessId, l.id, () =>
      this.dashboard.dashboard(period.from, period.to),
    );
    const pick = (p: typeof view.current): BranchMetrics => ({
      revenueMinor: num(p.revenue.totalMinor),
      occupiedNights: p.occupancy.occupiedNights,
      unitNights: p.occupancy.unitNights,
      guests: p.arrivals.guests,
      bookings: p.arrivals.count,
    });
    return { metrics: pick(view.current), previous: pick(view.previous) };
  }

  private async activity(): Promise<OverviewActivity[]> {
    const rows = await this.repo.activity(60);
    const out: OverviewActivity[] = [];
    for (const r of rows) {
      const label = activityLabel(r.action, r.after);
      if (!label) continue;
      out.push({
        id: r.id,
        at: r.createdAt.toISOString(),
        label: label.label,
        detail: label.detail,
        organizationId: r.organizationId,
        organizationName: r.organizationName,
      });
      if (out.length >= ACTIVITY_SHOWN) break;
    }
    return out;
  }
}

const ids = (locations: TreeLocation[], vertical: TreeLocation['vertical']): string[] =>
  locations.filter((l) => l.vertical === vertical).map((l) => l.id);
