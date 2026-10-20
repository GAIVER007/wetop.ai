/**
 * «Сколько принёс сотрудник» на экранах персонала (docs/decisions/2026-10-20-personnel-revenue.md): оплачено минус
 * возвраты за день, неделю или месяц. Суммы считает сервер в тиынах; здесь только подписи, валюты не смешиваются.
 */
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
  { value: 'day', label: 'День', title: 'сегодня' },
  { value: 'week', label: 'Неделя', title: 'за неделю' },
  { value: 'month', label: 'Месяц', title: 'за месяц' },
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
  BEAUTY: 'Без мастера',
  FOOD_SERVICE: 'Заказы без официанта',
  HOSPITALITY: 'Брони из каналов и сайта',
};

/** Деньги без сотрудника не теряются: отдельной строкой под списком; нет таких денег = null */
export function unattributedLabel(
  items: readonly StaffRevenueItem[],
  vertical: keyof typeof UNATTRIBUTED,
): string | null {
  const parts = items.filter((i) => i.employeeId === null).map((i) => formatMoney(i.netMinor, i.currency));
  return parts.length ? `${UNATTRIBUTED[vertical]}: ${parts.join(' · ')}` : null;
}
