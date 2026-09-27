import {
  DASHBOARD_FUNDS,
  resolvePeriod,
  type DashboardFund,
  type ResolvedPeriod,
} from '@pms/domain';

export const ANALYTICS_PATH = '/management/analytics';

/** Готовые отрезки «Аналитики» — по ТЗ §4: без «Вчера», его закрывает свой период */
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
  period: ResolvedPeriod;
  fund: DashboardFund;
  compare: boolean;
}

/** Адрес «Обзора»: период, тип фонда, сравнение. Значения по умолчанию в адрес не пишутся */
export function analyticsHref(q: AnalyticsQuery, patch: Partial<AnalyticsQuery> = {}): string {
  const next = { ...q, ...patch };
  const sp = new URLSearchParams();
  const p = next.period;
  if (p.preset === 'custom') {
    sp.set('period', 'custom');
    sp.set('from', p.from);
    sp.set('to', p.to);
  } else if (p.preset !== 'month') sp.set('period', p.preset);
  if (next.fund !== 'all') sp.set('fund', next.fund);
  if (!next.compare) sp.set('compare', '0');
  const s = sp.toString();
  return s ? `${ANALYTICS_PATH}?${s}` : ANALYTICS_PATH;
}

/** Разбор адреса: по умолчанию — этот месяц, весь фонд, сравнение включено */
export function parseAnalyticsQuery(
  sp: Record<string, string | undefined>,
  today: string,
): AnalyticsQuery {
  const period = resolvePeriod(
    { preset: sp.period ?? (sp.from || sp.to ? 'custom' : 'month'), from: sp.from, to: sp.to },
    today,
  );
  const fund = DASHBOARD_FUNDS.includes(sp.fund as DashboardFund)
    ? (sp.fund as DashboardFund)
    : 'all';
  return { period, fund, compare: sp.compare !== '0' };
}
