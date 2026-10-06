import {
  DASHBOARD_FUNDS,
  resolvePeriod,
  type DashboardFund,
  type ResolvedPeriod,
} from '@pms/domain';

export const ANALYTICS_PATH = '/management/analytics';

/** Вкладки модуля с полосой периода: «Обзор» (AN1), «Загрузка» (AN2) и «По номерам» (REP3) */
export type AnalyticsTab = 'overview' | 'occupancy' | 'units';
const TAB_PATH: Record<AnalyticsTab, string> = {
  overview: ANALYTICS_PATH,
  occupancy: `${ANALYTICS_PATH}/occupancy`,
  units: `${ANALYTICS_PATH}/units`,
};
/** Отрезок по умолчанию: «Обзор» отвечает за месяц, «Загрузка» — за сегодняшний день, как прежняя «Статистика» */
const TAB_DEFAULT: Record<AnalyticsTab, ResolvedPeriod['preset']> = {
  overview: 'month',
  occupancy: 'today',
  units: 'month',
};

/** Готовые отрезки «Аналитики» — по ТЗ §4: без «Вчера», его закрывает свой период и стрелки дня */
export const ANALYTICS_PRESETS = [
  { id: 'today', label: 'Сегодня' },
  { id: 'week', label: '7 дней' },
  { id: 'month', label: 'Этот месяц' },
  { id: 'last-month', label: 'Прошлый месяц' },
] as const;

export const FUND_LABELS: Record<DashboardFund, string> = {
  all: 'Все',
  rooms: 'Номера',
  beds: 'Койки',
};

export interface AnalyticsQuery {
  tab: AnalyticsTab;
  period: ResolvedPeriod;
  fund: DashboardFund;
  compare: boolean;
}

/**
 * Адрес вкладки: период, тип фонда, сравнение. Значения по умолчанию в адрес не пишутся; один день —
 * `?date=`, как ссылаются Главная, обход стойки и старый адрес «Статистики».
 */
export function analyticsHref(q: AnalyticsQuery, patch: Partial<AnalyticsQuery> = {}): string {
  const next = { ...q, ...patch };
  const sp = new URLSearchParams();
  const p = next.period;
  if (p.preset === 'custom' && p.from === p.to) sp.set('date', p.from);
  else if (p.preset === 'custom') {
    sp.set('period', 'custom');
    sp.set('from', p.from);
    sp.set('to', p.to);
  } else if (p.preset !== TAB_DEFAULT[next.tab]) sp.set('period', p.preset);
  if (next.fund !== 'all') sp.set('fund', next.fund);
  if (!next.compare) sp.set('compare', '0');
  const s = sp.toString();
  return s ? `${TAB_PATH[next.tab]}?${s}` : TAB_PATH[next.tab];
}

const addDays = (date: string, n: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const isDate = (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) &&
  addDays(v, 0) === v;

/** Один день со сдвигом — для стрелок «‹ ›»; сегодняшний день называется «Сегодня» */
export function dayPeriod(date: string, shift: number, today: string): ResolvedPeriod {
  const d = addDays(date, shift);
  return { preset: d === today ? 'today' : 'custom', from: d, to: d };
}

/** Разбор адреса: по умолчанию — отрезок вкладки, весь фонд, сравнение включено */
export function parseAnalyticsQuery(
  sp: Record<string, string | undefined>,
  today: string,
  tab: AnalyticsTab = 'overview',
): AnalyticsQuery {
  const fund = DASHBOARD_FUNDS.includes(sp.fund as DashboardFund)
    ? (sp.fund as DashboardFund)
    : 'all';
  const base = { tab, fund, compare: sp.compare !== '0' };
  const legacyDate = !sp.period && !sp.from && !sp.to && sp.date !== undefined;
  if (legacyDate && !isDate(sp.date!))
    return {
      ...base,
      period: { preset: 'today', from: today, to: today, error: 'Некорректная дата' },
    };
  const period = resolvePeriod(
    legacyDate
      ? { date: sp.date }
      : {
          preset: sp.period ?? (sp.from || sp.to ? 'custom' : TAB_DEFAULT[tab]),
          from: sp.from,
          to: sp.to,
        },
    today,
  );
  // сегодняшний день своим периодом — это «Сегодня»: подсвечен отрезок, адрес короче
  const todayOnly = period.preset === 'custom' && period.from === today && period.to === today;
  return { ...base, period: todayOnly ? { preset: 'today', from: today, to: today } : period };
}
