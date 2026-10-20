/**
 * «Сколько принёс сотрудник» на экранах персонала (docs/decisions/2026-10-20-personnel-revenue.md): оплачено минус
 * возвраты за день, неделю или месяц. Суммы считает сервер в тиынах; здесь только подписи, валюты не смешиваются.
 */
import { formatMoney } from './money';
import { deltaPercent, type Delta } from './dashboard-format';

export type StaffRevenuePeriod = 'day' | 'week' | 'month';
export interface StaffRevenueItem {
  employeeId: string | null;
  currency: string;
  paidMinor: string;
  refundedMinor: string;
  netMinor: string;
  name?: string | null;
}
export interface StaffRevenueTotal {
  currency: string;
  paidMinor: string;
  refundedMinor: string;
  netMinor: string;
}
export interface StaffRevenue {
  period: StaffRevenuePeriod;
  fromDate: string;
  toDate: string;
  items: StaffRevenueItem[];
  /** итоги периода по валютам (все деньги, и без сотрудника); старый API без них: считаются из items */
  totals?: StaffRevenueTotal[];
  /** та же доля прошлого периода для сравнения */
  previous?: { fromDate: string; toDate: string; totals: StaffRevenueTotal[] };
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

/** Сколько принесли все за период, включая деньги без сотрудника; валюты не смешиваются: «12 000 ₸ · 50 USD» */
export function revenueTotal(items: readonly StaffRevenueItem[]): string {
  const sums = new Map<string, bigint>();
  for (const i of items) sums.set(i.currency, (sums.get(i.currency) ?? 0n) + BigInt(i.netMinor));
  if (sums.size === 0) return formatMoney('0');
  return [...sums].map(([currency, minor]) => formatMoney(minor, currency)).join(' · ');
}

const COMPARED: Record<StaffRevenuePeriod, string> = { day: 'к вчера', week: 'к прошлой неделе', month: 'к прошлому месяцу' };
/** доля целыми процентами с округлением; меньше 1 % показываем «< 1 %», а не ноль */
const pct = (part: bigint, whole: bigint) => {
  if (whole === 0n) return null;
  const r = Math.round(Number((part * 10000n) / whole) / 100);
  return part > 0n && r === 0 ? '< 1 %' : `${r} %`;
};

export interface StaffSummaryStat {
  label: string;
  value: string | number;
  hint?: string;
  delta?: Delta;
  tone?: 'warning';
  testId?: string;
}

/**
 * Плитки над списком персонала (замечание владельца 20.10.2026: «на смене сейчас» не нужно, нужна полезная сводка):
 * сколько принесла команда и как к прошлому периоду, кто лучший, сколько в среднем на сотрудника, возвраты; «Не
 * назначено» только когда есть что назначить. Валюта: основная (первая) из итогов, другие валюты не смешиваются.
 */
export function staffSummaryStats({
  revenue,
  names,
  earners,
  unassigned,
  people = 0,
}: {
  revenue: StaffRevenue | null;
  /** имена сотрудников по id для «Лучший» */
  names: ReadonlyMap<string, string>;
  /** сколько людей приносят деньги (специалисты и «оба», активные) */
  earners: number;
  unassigned: number;
  /** состав без права на отчёты */
  people?: number;
}): StaffSummaryStat[] {
  const warn: StaffSummaryStat[] = unassigned
    ? [{ label: 'Не назначено', value: unassigned, tone: 'warning', hint: 'укажите, кто это', testId: 'staff-unassigned' }]
    : [];
  if (!revenue) return [{ label: 'В персонале', value: people, testId: 'staff-count' }, ...(unassigned ? warn : [{ label: 'Не назначено', value: 0 }])];
  const totals =
    revenue.totals ??
    (() => {
      const m = new Map<string, StaffRevenueTotal>();
      for (const i of revenue.items) {
        const t = m.get(i.currency) ?? { currency: i.currency, paidMinor: '0', refundedMinor: '0', netMinor: '0' };
        m.set(i.currency, {
          currency: i.currency,
          paidMinor: String(BigInt(t.paidMinor) + BigInt(i.paidMinor)),
          refundedMinor: String(BigInt(t.refundedMinor) + BigInt(i.refundedMinor)),
          netMinor: String(BigInt(t.netMinor) + BigInt(i.netMinor)),
        });
      }
      return [...m.values()];
    })();
  const main = totals[0];
  const currency = main?.currency ?? 'KZT';
  const net = BigInt(main?.netMinor ?? '0');
  const paid = BigInt(main?.paidMinor ?? '0');
  const refunded = BigInt(main?.refundedMinor ?? '0');
  const title = periodTitle(revenue.period);
  const before = revenue.previous?.totals.find((t) => t.currency === currency);
  const change = before && BigInt(before.netMinor) !== 0n ? deltaPercent(net, BigInt(before.netMinor)) : null;
  const best = revenue.items
    .filter((i) => i.employeeId !== null && i.currency === currency && BigInt(i.netMinor) > 0n)
    .sort((a, b) => (BigInt(b.netMinor) > BigInt(a.netMinor) ? 1 : -1))[0];
  const bestShare = best ? pct(BigInt(best.netMinor), net) : null;
  const attributed = revenue.items
    .filter((i) => i.employeeId !== null && i.currency === currency)
    .reduce((a, i) => a + BigInt(i.netMinor), 0n);
  const others = totals.slice(1).map((t) => formatMoney(t.netMinor, t.currency));
  return [
    {
      label: `Принесли ${title}`,
      value: formatMoney(net, currency),
      hint:
        paid === 0n && refunded === 0n
          ? 'оплат за период ещё не было'
          : `оплачено ${formatMoney(paid, currency)}${others.length ? `; ещё ${others.join(', ')}` : ''}`,
      ...(change ? { delta: { ...change, text: `${change.text} ${COMPARED[revenue.period]}` } } : {}),
      testId: 'staff-total',
    },
    {
      label: `Лучший ${title}`,
      value: best ? (names.get(best.employeeId!) ?? 'Сотрудник') : '—',
      hint: best ? `${formatMoney(best.netMinor, currency)}${bestShare ? `, ${bestShare} от всех денег` : ''}` : 'пока никто не принёс денег',
      testId: 'staff-best',
    },
    {
      label: 'В среднем на сотрудника',
      value: earners > 0 && attributed > 0n ? formatMoney(attributed / BigInt(earners), currency) : '—',
      hint: `приносят деньги: ${earners}`,
      testId: 'staff-average',
    },
    {
      label: `Возвраты ${title}`,
      value: formatMoney(refunded, currency),
      hint: refunded > 0n && pct(refunded, paid) ? `${pct(refunded, paid)} от оплат` : 'возвратов не было',
      testId: 'staff-refunds',
    },
    ...warn,
  ];
}
