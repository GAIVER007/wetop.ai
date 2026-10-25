/**
 * «Сколько принёс сотрудник» на экранах персонала (docs/decisions/2026-10-20-personnel-revenue.md): оплачено минус
 * возвраты за день, неделю или месяц. Суммы считает сервер в тиынах; здесь только подписи, валюты не смешиваются.
 */
import { msg, translator, type Translate } from '../i18n';
import { formatMoney } from './money';

export type StaffRevenuePeriod = 'day' | 'week' | 'month';
export interface StaffRevenueItem {
  employeeId: string | null;
  currency: string;
  paidMinor: string;
  refundedMinor: string;
  netMinor: string;
  name?: string | null;
}
export interface StaffRevenue {
  period: StaffRevenuePeriod;
  fromDate: string;
  toDate: string;
  items: StaffRevenueItem[];
}

export const STAFF_REVENUE_PERIODS: ReadonlyArray<{ value: StaffRevenuePeriod; label: string; title: string }> = [
  { value: 'day', label: msg('День'), title: msg('сегодня') },
  { value: 'week', label: msg('Неделя'), title: msg('за неделю') },
  { value: 'month', label: msg('Месяц'), title: msg('за месяц') },
];

export function revenuePeriodParam(raw: string | string[] | undefined): StaffRevenuePeriod {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === 'week' || v === 'month' ? v : 'day';
}

export function periodHref(path: string, period: StaffRevenuePeriod): string {
  return period === 'day' ? path : `${path}?period=${period}`;
}

export function periodTitle(period: StaffRevenuePeriod): string {
  return STAFF_REVENUE_PERIODS.find((p) => p.value === period)!.title;
}

/** Сумма каждого сотрудника строкой: «9 000 ₸ · 50 USD»; сотрудника без денег в карте нет */
export function revenueCells(items: readonly StaffRevenueItem[]): Map<string, string> {
  const out = new Map<string, string[]>();
  for (const item of items) {
    if (item.employeeId === null) continue;
    out.set(item.employeeId, [...(out.get(item.employeeId) ?? []), formatMoney(item.netMinor, item.currency)]);
  }
  return new Map([...out].map(([id, parts]) => [id, parts.join(' · ')]));
}

const UNATTRIBUTED: Record<'BEAUTY' | 'FOOD_SERVICE' | 'HOSPITALITY', string> = {
  BEAUTY: msg('Без мастера'),
  FOOD_SERVICE: msg('Заказы без официанта'),
  HOSPITALITY: msg('Брони из каналов и сайта'),
};

/** Деньги без сотрудника не теряются: отдельной строкой под списком; нет таких денег = null */
export function unattributedLabel(
  items: readonly StaffRevenueItem[],
  vertical: keyof typeof UNATTRIBUTED,
  t: Translate = translator('ru'),
): string | null {
  const parts = items.filter((i) => i.employeeId === null).map((i) => formatMoney(i.netMinor, i.currency));
  return parts.length ? `${t(UNATTRIBUTED[vertical])}: ${parts.join(' · ')}` : null;
}

/** Сколько принесли все за период, включая деньги без сотрудника; валюты не смешиваются: «12 000 ₸ · 50 USD» */
export function revenueTotal(items: readonly StaffRevenueItem[]): string {
  const sums = new Map<string, bigint>();
  for (const i of items) sums.set(i.currency, (sums.get(i.currency) ?? 0n) + BigInt(i.netMinor));
  if (sums.size === 0) return formatMoney('0');
  return [...sums].map(([currency, minor]) => formatMoney(minor, currency)).join(' · ');
}
