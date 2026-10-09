import type { SalesSummary } from './api';
import { deltaPercent, type Delta } from './dashboard-format';

/**
 * Хаб «Продажи» (SALES2.2): то, что экран считает сам. Без запросов и разметки. Правило страницы: неизвестное не
 * рисуется нулём. Нет предложений, нет и конверсии; нет базы сравнения, нет и «+0 %».
 */

const DAY_MS = 86_400_000;
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const ms = (date: string) => Date.parse(`${date}T00:00:00Z`);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (v: string | undefined): v is string =>
  !!v && DATE.test(v) && !Number.isNaN(ms(v)) && ymd(ms(v)) === v;

/** Через сколько дней без снимков данные конкурентов считаются устаревшими */
export const STALE_AFTER_DAYS = 3;

export type SalesPreset = '7' | '30' | 'custom';
export interface SalesPeriod {
  from: string;
  to: string;
  preset: SalesPreset;
}

/** Период из адреса: готовые 7 и 30 дней до сегодня объекта или свои даты; всё неверное возвращает к 30 дням */
export function salesPeriod(
  query: { days?: string | undefined; from?: string | undefined; to?: string | undefined },
  today: string,
): SalesPeriod {
  const lastDays = (n: number): SalesPeriod => ({
    from: ymd(ms(today) - (n - 1) * DAY_MS),
    to: today,
    preset: n === 7 ? '7' : '30',
  });
  if (validDate(query.from) && validDate(query.to) && query.from <= query.to) {
    const days = (ms(query.to) - ms(query.from)) / DAY_MS + 1;
    if (days <= 366) return { from: query.from, to: query.to, preset: 'custom' };
  }
  return lastDays(query.days === '7' ? 7 : 30);
}

/** Изменение числа к прошлому отрезку; нулевая база сравнения не даёт */
export const countDelta = (current: number, previous: number): Delta =>
  deltaPercent(current, previous);

export const moneyDelta = (currentMinor: string, previousMinor: string): Delta =>
  deltaPercent(BigInt(currentMinor), BigInt(previousMinor));

const percent = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
/** 375 → «37,5 %»; `null` остаётся `null`, чтобы экран показал причину, а не «0 %» */
export const conversionText = (permille: number | null): string | null =>
  permille === null ? null : `${percent.format(permille / 10)} %`;

export type Freshness =
  | { state: 'fresh' | 'stale'; ageDays: number }
  | { state: 'none' | 'empty'; ageDays: null };

/** Свежесть данных конкурентов: нет конкурентов, конкуренты без снимков, свежо, устарело */
export function competitorsFreshness(
  competitors: SalesSummary['competitors'],
  today: string,
): Freshness {
  if (competitors.count === 0) return { state: 'empty', ageDays: null };
  if (!competitors.lastObservedOn) return { state: 'none', ageDays: null };
  const ageDays = Math.max(0, Math.round((ms(today) - ms(competitors.lastObservedOn)) / DAY_MS));
  return { state: ageDays > STALE_AFTER_DAYS ? 'stale' : 'fresh', ageDays };
}
