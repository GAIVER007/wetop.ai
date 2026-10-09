import {
  occupancyPercent,
  revenueByCurrency,
  sumMetric,
  type OverviewBranch,
  type OverviewOrganization,
  type OverviewVertical,
  type PlatformOverview,
} from '@pms/domain';
import { formatMoney } from './money';

/**
 * «Платформа → Организации»: слова и сводки для страницы. Числа считает API; здесь только отбор, порядок, подписи и
 * складывание готовых величин теми же правилами (общий числитель и знаменатель, валюты раздельно, null это «нет данных»).
 */
export const VERTICAL_ORDER: readonly OverviewVertical[] = ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'];

export const VERTICAL_NAME: Record<OverviewVertical, string> = {
  HOSPITALITY: 'Гостиничный бизнес',
  BEAUTY: 'Салон красоты',
  FOOD_SERVICE: 'Ресторанный бизнес',
};
/** Во множественном числе: подписи вкладок и плиток */
export const VERTICAL_PLURAL: Record<OverviewVertical, string> = {
  HOSPITALITY: 'Отели',
  BEAUTY: 'Салоны красоты',
  FOOD_SERVICE: 'Рестораны',
};

export type VerticalFilter = 'all' | OverviewVertical;
export type OrganizationSort = 'date' | 'name' | 'revenue';
export type OrganizationView = 'cards' | 'list';

export const SORT_LABEL: Record<OrganizationSort, string> = {
  date: 'По дате',
  name: 'По названию',
  revenue: 'По доходу',
};

export function parseVerticalFilter(raw: unknown): VerticalFilter {
  return VERTICAL_ORDER.includes(raw as OverviewVertical) ? (raw as OverviewVertical) : 'all';
}
export function parseSort(raw: unknown): OrganizationSort {
  return raw === 'name' || raw === 'revenue' ? raw : 'date';
}
export function parseView(raw: unknown): OrganizationView {
  return raw === 'list' ? 'list' : 'cards';
}

/** Направление организации: направление её первого бизнеса (у организации без бизнеса его нет) */
export const primaryVertical = (o: OverviewOrganization): OverviewVertical | null => o.businesses[0]?.vertical ?? null;

export const hasVertical = (o: OverviewOrganization, v: OverviewVertical): boolean =>
  o.businesses.some((b) => b.vertical === v);

/** Сколько организаций в каждой вкладке */
export function verticalCounts(orgs: readonly OverviewOrganization[]): Record<VerticalFilter, number> {
  const out: Record<VerticalFilter, number> = { all: orgs.length, HOSPITALITY: 0, BEAUTY: 0, FOOD_SERVICE: 0 };
  for (const o of orgs) for (const v of VERTICAL_ORDER) if (hasVertical(o, v)) out[v] += 1;
  return out;
}

/** Цифры организации за период: из её филиалов, а не из готовых процентов */
export function organizationFigures(o: Pick<OverviewOrganization, 'branches'>) {
  return {
    revenue: revenueByCurrency(o.branches),
    occupancy: occupancyPercent(o.branches),
    guests: sumMetric(o.branches, 'guests'),
    bookings: sumMetric(o.branches, 'bookings'),
  };
}

/** Доход одной строкой по валютам: «4 320 000 ₸, 1 200 USD»; пусто, если дохода нет ни у одного филиала */
export function revenueLine(revenue: Record<string, number>): string | null {
  const parts = Object.entries(revenue)
    .sort((a, b) => b[1] - a[1])
    .map(([currency, minor]) => formatMoney(BigInt(Math.round(minor)), currency));
  return parts.length > 0 ? parts.join(', ') : null;
}

const mainRevenue = (o: OverviewOrganization): number => {
  const values = Object.values(organizationFigures(o).revenue);
  return values.length > 0 ? Math.max(...values) : -1;
};

export function selectOrganizations(
  orgs: readonly OverviewOrganization[],
  filter: VerticalFilter,
  sort: OrganizationSort,
  query = '',
): OverviewOrganization[] {
  const needle = query.trim().toLocaleLowerCase('ru');
  const shown = orgs.filter((o) => {
    if (filter !== 'all' && !hasVertical(o, filter)) return false;
    if (!needle) return true;
    return (
      o.name.toLocaleLowerCase('ru').includes(needle) ||
      o.branches.some((b) => `${b.name} ${b.address ?? ''}`.toLocaleLowerCase('ru').includes(needle))
    );
  });
  return [...shown].sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name, 'ru');
    if (sort === 'revenue') return mainRevenue(b) - mainRevenue(a) || a.name.localeCompare(b.name, 'ru');
    // новые сверху
    return b.createdAt.localeCompare(a.createdAt) || a.name.localeCompare(b.name, 'ru');
  });
}

/** Итоги верхних плиток */
export function overviewTotals(data: Pick<PlatformOverview, 'organizations' | 'newOrganizations'>) {
  const orgs = data.organizations;
  const branches = orgs.flatMap((o) => o.branches);
  const businesses = orgs.flatMap((o) => o.businesses);
  const byVertical = Object.fromEntries(
    VERTICAL_ORDER.map((v) => [v, businesses.filter((b) => b.vertical === v).length]),
  ) as Record<OverviewVertical, number>;
  const current = revenueByCurrency(branches);
  const previous = revenueByCurrency(branches.map((b) => ({ currency: b.currency, metrics: b.previous })));
  return {
    organizations: orgs.length,
    working: orgs.filter((o) => o.status === 'ACTIVE').length,
    newOrganizations: data.newOrganizations,
    branches: branches.length,
    businesses: businesses.length,
    byVertical,
    revenue: current,
    previousRevenue: previous,
    withoutRevenue: branches.some((b) => b.vertical === 'FOOD_SERVICE'),
  };
}

/** Распределение по направлениям: доля дохода в основной валюте; нет дохода, доля филиалов */
export function distribution(orgs: readonly OverviewOrganization[]): {
  basis: string;
  rows: Array<{ vertical: OverviewVertical; value: number; percent: number }>;
} {
  const branches = orgs.flatMap((o) => o.branches);
  const totals = revenueByCurrency(branches);
  const [main] = Object.entries(totals).sort((a, b) => b[1] - a[1])[0] ?? [];
  const valueOf = (v: OverviewVertical): number =>
    main
      ? branches
          .filter((b) => b.vertical === v && b.currency === main)
          .reduce((a, b) => a + (b.metrics.revenueMinor ?? 0), 0)
      : branches.filter((b) => b.vertical === v).length;
  const values = VERTICAL_ORDER.map((v) => ({ vertical: v, value: valueOf(v) })).filter((r) => r.value > 0);
  const sum = values.reduce((a, r) => a + r.value, 0);
  return {
    basis: main ? `по доходу, ${main}` : 'по числу филиалов',
    rows: values.map((r) => ({ ...r, percent: sum > 0 ? Math.round((r.value / sum) * 100) : 0 })),
  };
}

/** Значение справа в строке филиала: загрузка гостиницы, клиенты салона, гости ресторана */
export function branchFigure(b: OverviewBranch): { text: string; percent: number | null } {
  if (b.vertical === 'HOSPITALITY') {
    const p = occupancyPercent([b]);
    return p === null ? { text: 'нет данных', percent: null } : { text: `${p}%`, percent: p };
  }
  const n = b.metrics.guests;
  if (n === null) return { text: 'нет данных', percent: null };
  return { text: `${n} ${b.vertical === 'BEAUTY' ? plural(n, 'клиент', 'клиента', 'клиентов') : plural(n, 'гость', 'гостя', 'гостей')}`, percent: null };
}

export function plural(n: number, one: string, few: string, many: string): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

/** «2 часа назад», «вчера», «5 дней назад» */
export function relativeAgo(iso: string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} ${plural(minutes, 'минуту', 'минуты', 'минут')} назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${plural(hours, 'час', 'часа', 'часов')} назад`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'вчера';
  return `${days} ${plural(days, 'день', 'дня', 'дней')} назад`;
}

/** Адрес первого филиала для строки под названием; нет адреса, нет строки */
export const organizationPlace = (o: OverviewOrganization): string | null =>
  o.branches.find((b) => b.address)?.address ?? null;

/** Месяц `ГГГГ-ММ` словами: «октябрь 2026» */
export function monthName(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Intl.DateTimeFormat('ru', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
}
