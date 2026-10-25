import { unstable_rethrow } from 'next/navigation';
import { msg } from '../../i18n';
import {
  branchFoodPeriod,
  branchReportDay,
  sellerApi,
  type BeautyAppointmentRow,
  type BeautyDay,
  type BranchItem,
  type SellerSummary,
} from '../../lib/api';
import { completeFoodList, validFoodReservation } from '../../lib/food-data';
import type { FoodPage, FoodPeriodReport, RestaurantReservation } from '../../lib/food-types';
import { sellerConnected } from '../../lib/ai-seller';
import { selectedWorkspaceBranch } from '../../lib/workspace-context';
import { localInput } from '../beauty/time';
import { periodDates } from '../management/analytics/vertical/metrics';

/**
 * Данные хаба «Продажи» салона и ресторана (единая система направлений, 14.10.2026). Источники те же, что у
 * «Аналитики» и «Финансов» этих направлений, ничего не выдумывается:
 * - салон: записи филиала по дням (`/beauty/appointments?date=`), выручка это снимки цен DONE (Q-252);
 * - ресторан: отчёт периода (`/food-service/period-report`) и брони столов по дням;
 * - ИИ-продавец: `/ai-seller/status` и `/ai-seller/summary` организации.
 * Каждый источник читается отдельно: упал один, остальные плитки показываются.
 */
export type SalesPreset = '7' | '30' | 'custom';

export interface SalesPeriod {
  from: string;
  to: string;
  preset: SalesPreset;
}

export interface Ranked {
  name: string;
  count: number;
  revenueMinor: string;
}

export interface BusinessSalesData {
  period: SalesPeriod;
  currency: string;
  revenueMinor: string | null;
  averageCheckMinor: string | null;
  /** оказанные услуги (салон) или закрытые заказы (ресторан) */
  sold: number | null;
  /** записи или брони столов за период, всех статусов */
  bookings: number | null;
  /** неявки и отмены */
  lost: number | null;
  /** гости закрытых заказов (ресторан) */
  guests: number | null;
  top: Ranked[];
  team: Ranked[];
  seller: { connected: boolean; extensionOff: boolean; summary: SellerSummary | null } | null;
  error: string | null;
}

const DAY = 86_400_000;
const shift = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

/** Период из адреса: `days=7|30` или `from`/`to` (до 31 дня, как у аналитики); по умолчанию 7 дней до сегодня */
export function salesPeriodFor(
  sp: Record<string, string | undefined>,
  today: string,
): SalesPeriod {
  if (sp.from && sp.to) {
    try {
      periodDates(sp.from, sp.to);
      if (sp.to <= today) return { from: sp.from, to: sp.to, preset: 'custom' };
    } catch {
      /* неверный период: обычные 7 дней */
    }
  }
  const days = sp.days === '30' ? 30 : 7;
  return { from: shift(today, -(days - 1)), to: today, preset: days === 30 ? '30' : '7' };
}

const add = (map: Map<string, { count: number; revenue: bigint }>, key: string, minor: string) => {
  const row = map.get(key) ?? { count: 0, revenue: 0n };
  row.count += 1;
  row.revenue += BigInt(minor || '0');
  map.set(key, row);
};
const ranked = (map: Map<string, { count: number; revenue: bigint }>, limit = 5): Ranked[] =>
  [...map.entries()]
    .sort(([, a], [, b]) => (b.revenue === a.revenue ? b.count - a.count : b.revenue > a.revenue ? 1 : -1))
    .slice(0, limit)
    .map(([name, v]) => ({ name, count: v.count, revenueMinor: v.revenue.toString() }));

/** Чистый расчёт салона по записям периода: проверяется тестом без сети */
export function beautySales(days: BeautyDay[]) {
  const names = new Map<string, string>();
  for (const d of days) for (const c of d.columns) names.set(c.id, c.name);
  const rows: BeautyAppointmentRow[] = days.flatMap((d) => d.appointments);
  const done = rows.filter((r) => r.status === 'DONE');
  const revenue = done.reduce((s, r) => s + BigInt(r.priceMinor || '0'), 0n);
  const services = new Map<string, { count: number; revenue: bigint }>();
  const masters = new Map<string, { count: number; revenue: bigint }>();
  for (const r of done) {
    const visitMasters = new Map<string, bigint>();
    for (const item of r.items?.length ? r.items : [r]) {
      add(services, item.serviceName, item.priceMinor);
      visitMasters.set(item.employeeId, (visitMasters.get(item.employeeId) ?? 0n) + BigInt(item.priceMinor));
    }
    for (const [employeeId, price] of visitMasters)
      add(masters, names.get(employeeId) ?? 'Мастер', price.toString()); // kk-allow: запасное имя исполнителя идёт строкой рейтинга вместе с именами из API (данные)
  }
  return {
    currency: days.at(-1)?.location.currency ?? done[0]?.currency ?? 'KZT',
    revenueMinor: revenue.toString(),
    averageCheckMinor: done.length ? (revenue / BigInt(done.length)).toString() : null,
    sold: done.length,
    bookings: rows.length,
    lost: rows.filter((r) => r.status === 'NO_SHOW' || r.status === 'CANCELLED').length,
    top: ranked(services),
    team: ranked(masters),
  };
}

/** Чистый расчёт ресторана: отчёт периода и брони столов */
export function foodSales(report: FoodPeriodReport | null, reservations: RestaurantReservation[] | null) {
  return {
    currency: report?.currency ?? 'KZT',
    revenueMinor: report?.revenueMinor ?? null,
    averageCheckMinor: report?.averageCheckMinor ?? null,
    sold: report?.ordersCount ?? null,
    guests: report?.guestsCount ?? null,
    bookings: reservations ? reservations.length : null,
    lost: reservations
      ? reservations.filter((r) => r.status === 'NO_SHOW' || r.status === 'CANCELLED').length
      : null,
    top: (report?.topDishes ?? []).slice(0, 5).map((d) => ({ name: d.name, count: d.qty, revenueMinor: d.revenueMinor })),
    team: (report?.waiters ?? []).slice(0, 5).map((w) => ({ name: w.name, count: w.orders, revenueMinor: w.revenueMinor })),
  };
}

const quiet = async <T,>(p: Promise<T>): Promise<T | null> => {
  try {
    return await p;
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
};

async function loadSeller(): Promise<BusinessSalesData['seller']> {
  const status = await quiet(sellerApi.status());
  if (!status) return null;
  const connected = sellerConnected(status) && status.state !== 'extension-off';
  return {
    connected,
    extensionOff: status.state === 'extension-off',
    summary: connected ? await quiet(sellerApi.summary()) : null,
  };
}

async function beautyDays(branch: BranchItem, dates: string[]): Promise<BeautyDay[]> {
  const out: BeautyDay[] = [];
  // по дням последовательно, как у аналитики: нагрузка на API ограничена
  for (const date of dates) out.push((await branchReportDay(branch, date)) as BeautyDay);
  return out;
}

async function foodReservations(branch: BranchItem, dates: string[]): Promise<RestaurantReservation[]> {
  const out: RestaurantReservation[] = [];
  for (const date of dates) {
    const rows = await completeFoodList<RestaurantReservation>(
      (cursor) => branchReportDay(branch, date, cursor) as Promise<FoodPage<RestaurantReservation>>,
      validFoodReservation,
    );
    // брони дня включают пересечения: в период идёт бронь по местной дате начала
    out.push(...rows.filter((r) => localInput(r.startsAt, branch.timezone).slice(0, 10) === date));
  }
  return out;
}

export async function loadBusinessSales(
  sp: Record<string, string | undefined>,
): Promise<BusinessSalesData> {
  const branch = await selectedWorkspaceBranch();
  const today = branch
    ? localInput(new Date().toISOString(), branch.timezone).slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const period = salesPeriodFor(sp, today);
  const seller = await loadSeller();
  const empty: BusinessSalesData = {
    period,
    currency: branch?.currency ?? 'KZT',
    revenueMinor: null,
    averageCheckMinor: null,
    sold: null,
    bookings: null,
    lost: null,
    guests: null,
    top: [],
    team: [],
    seller,
    error: branch ? null : msg('Выберите филиал, чтобы увидеть продажи.'),
  };
  if (!branch) return empty;
  const dates = periodDates(period.from, period.to);
  try {
    if (branch.vertical === 'BEAUTY') {
      return { ...empty, ...beautySales(await beautyDays(branch, dates)), guests: null };
    }
    const [report, reservations] = await Promise.all([
      quiet(branchFoodPeriod(branch, period.from, period.to)),
      quiet(foodReservations(branch, dates)),
    ]);
    return {
      ...empty,
      ...foodSales(report, reservations),
      error: report || reservations ? null : msg('Не удалось получить данные ресторана. Обновите страницу.'),
    };
  } catch (error) {
    unstable_rethrow(error);
    return { ...empty, error: msg('Не удалось получить данные филиала. Обновите страницу.') };
  }
}
