import { BadRequestException } from '@nestjs/common';

/**
 * Хаб «Продажи» (SALES2.2): чистая логика сводки без базы. «Брони из диалогов» и «связанная выручка» считаются ТОЛЬКО по
 * подтверждённым намерениям бота (`seller_booking_intents.reservation_id`): `source` у брони для этого не годится,
 * WEBSITE бывает и у обычного виджета. Определение выручки (D8 отчёта `plans/sales2-audit-2026-10-09.md`): сумма
 * `total_amount` подтверждённых броней без отменённых и незаездов, период по дате создания намерения в поясе объекта.
 */
const MAX_DAYS = 366;
const DAY_MS = 86_400_000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const toMs = (date: string) => Date.parse(`${date}T00:00:00Z`);
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export interface Period {
  from: string;
  to: string;
}

const validDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !DATE.test(value)) return false;
  const ms = toMs(value);
  // 2026-13-01 не дата: Date.parse даёт NaN, а 2026-02-30 сдвигается на март и не совпадёт с вводом
  return !Number.isNaN(ms) && fromMs(ms) === value;
};

export function parsePeriod(from: unknown, to: unknown): Period {
  if (!validDate(from) || !validDate(to)) throw new BadRequestException('Проверьте даты периода');
  if (from > to) throw new BadRequestException('Начало периода позже конца');
  if ((toMs(to) - toMs(from)) / DAY_MS + 1 > MAX_DAYS)
    throw new BadRequestException('Период длиннее года');
  return { from, to };
}

/** Прошлый отрезок той же длины, сразу перед текущим */
export function previousPeriod(from: string, to: string): Period {
  const days = (toMs(to) - toMs(from)) / DAY_MS + 1;
  return { from: fromMs(toMs(from) - days * DAY_MS), to: fromMs(toMs(from) - DAY_MS) };
}

export interface PeriodTotals {
  /** Намерения бота (предложение гостю с ценой), созданные за отрезок */
  offered: number;
  /** Из них подтверждённые, чья бронь не отменена и не «незаезд» */
  booked: number;
  revenueMinor: bigint;
  currency: string | null;
}

export interface CompetitorsTotals {
  count: number;
  lastObservedOn: string | null;
  /** Сколько конкурентов добавлено за последние 30 суток: «+2 с прошлого месяца» на хабе */
  addedLast30: number;
}

/** Доля в десятых долях процента (375 = 37,5 %); предложений нет, доли нет: неизвестное не равно нулю */
const permille = (booked: number, offered: number): number | null =>
  offered > 0 ? Math.round((booked * 1000) / offered) : null;

export function buildSalesSummary(input: {
  period: Period;
  current: PeriodTotals;
  previous: PeriodTotals;
  competitors: CompetitorsTotals;
}) {
  const { current, previous } = input;
  return {
    period: input.period,
    previousPeriod: previousPeriod(input.period.from, input.period.to),
    bookings: { current: current.booked, previous: previous.booked },
    offers: { current: current.offered, previous: previous.offered },
    conversionPermille: {
      current: permille(current.booked, current.offered),
      previous: permille(previous.booked, previous.offered),
    },
    revenue: {
      currentMinor: current.revenueMinor.toString(),
      previousMinor: previous.revenueMinor.toString(),
      currency: current.currency ?? previous.currency,
    },
    competitors: input.competitors,
  };
}
export type SalesSummary = ReturnType<typeof buildSalesSummary>;
