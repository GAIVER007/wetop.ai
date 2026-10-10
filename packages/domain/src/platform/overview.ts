import { previousPeriod } from '../dashboard/period';

/**
 * Сквозной обзор платформы («Платформа → Организации»): итоги, организации с филиалами, помесячный ряд и последние
 * действия. Здесь только формы ответа и чистая арифметика: откуда берутся числа, решает API.
 *
 * Правила арифметики те же, что у сводки по филиалам (план organizations-branches-2026-10-01):
 * - загрузка считается общим числителем и знаменателем, не средним процентом;
 * - деньги разных валют не складываются и не конвертируются, итог идёт отдельной строкой на валюту;
 * - показатель, которого у направления нет в модели, это `null` и «нет данных» на экране, а не ноль.
 */
export type OverviewVertical = 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE';

/** Цифры одного филиала за период; `null` — у направления такого показателя в модели нет или нет знаменателя */
export interface BranchMetrics {
  /** Доход в минорных единицах валюты филиала: начисления гостиницы, выполненные записи салона. У ресторана `null` */
  revenueMinor: number | null;
  /** Загрузка, проценты: только гостиница. Числитель и знаменатель нужны, чтобы складывать филиалы честно */
  occupiedNights: number | null;
  unitNights: number | null;
  /** Гости: заезды гостиницы, клиенты салона, посадка ресторана (сумма гостей по броням) */
  guests: number | null;
  /** Брони, записи */
  bookings: number | null;
}

export const EMPTY_METRICS: BranchMetrics = {
  revenueMinor: null,
  occupiedNights: null,
  unitNights: null,
  guests: null,
  bookings: null,
};

export interface OverviewBranch {
  id: string;
  name: string;
  address: string | null;
  currency: string;
  timezone: string;
  vertical: OverviewVertical;
  businessId: string;
  metrics: BranchMetrics;
  previous: BranchMetrics;
}

export interface OverviewBusiness {
  id: string;
  name: string;
  vertical: OverviewVertical;
}

export interface OverviewOrganization {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  owners: string[];
  businesses: OverviewBusiness[];
  branches: OverviewBranch[];
}

export interface OverviewSeriesPoint {
  /** `ГГГГ-ММ` */
  month: string;
  /** Доход по валютам, минорные единицы */
  revenue: Record<string, number>;
  occupiedNights: number;
  unitNights: number;
  guests: number;
}

export interface OverviewActivity {
  id: string;
  at: string;
  label: string;
  detail: string | null;
  organizationId: string | null;
  organizationName: string | null;
}

export interface PlatformOverview {
  period: { from: string; to: string; previousFrom: string; previousTo: string; month: string };
  organizations: OverviewOrganization[];
  series: OverviewSeriesPoint[];
  activity: OverviewActivity[];
  /** Организации, заведённые за последние 30 дней */
  newOrganizations: number;
}

/**
 * Состояние организации для экрана платформы без слов про пробный период: пробная работает до своего срока и затем
 * только читает, как и считает замок записи; остальные состояния как есть.
 */
export function visibleStatus(status: string, trialEndsAt: Date | null, now: Date): string {
  if (status !== 'TRIAL') return status;
  return trialEndsAt && trialEndsAt.getTime() <= now.getTime() ? 'READ_ONLY' : 'ACTIVE';
}

/** Рубеж периода: календарный месяц `ГГГГ-ММ`, текущий считается по сегодняшний день включительно */
export function platformMonthPeriod(month: string, today: string) {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const first = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const to = today >= first && today < last ? today : last;
  const prev = previousPeriod(first, to);
  return { from: first, to, previousFrom: prev.from, previousTo: prev.to, month };
}

export const isMonth = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

/** Последние `count` месяцев по `ГГГГ-ММ`, от старого к новому, включая текущий */
export function lastMonths(current: string, count: number): string[] {
  const [y, m] = current.split('-').map(Number) as [number, number];
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (count - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
}

/** Сумма дохода по валютам: филиалы без дохода (`null`) не дают нуля и в сумму не входят */
export function revenueByCurrency(
  rows: ReadonlyArray<{ currency: string; metrics: Pick<BranchMetrics, 'revenueMinor'> }>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    if (r.metrics.revenueMinor === null) continue;
    out[r.currency] = (out[r.currency] ?? 0) + r.metrics.revenueMinor;
  }
  return out;
}

/** Загрузка общим числителем и знаменателем; `null`, если считать не из чего */
export function occupancyPercent(
  rows: ReadonlyArray<{ metrics: Pick<BranchMetrics, 'occupiedNights' | 'unitNights'> }>,
): number | null {
  let occupied = 0;
  let total = 0;
  for (const r of rows) {
    if (r.metrics.occupiedNights === null || r.metrics.unitNights === null) continue;
    occupied += r.metrics.occupiedNights;
    total += r.metrics.unitNights;
  }
  return total > 0 ? Math.round((occupied / total) * 100) : null;
}

/** Сумма показателя по филиалам, у которых он есть; `null`, если его нет ни у одного */
export function sumMetric(
  rows: ReadonlyArray<{ metrics: BranchMetrics }>,
  key: 'guests' | 'bookings',
): number | null {
  let sum = 0;
  let any = false;
  for (const r of rows) {
    const v = r.metrics[key];
    if (v === null) continue;
    sum += v;
    any = true;
  }
  return any ? sum : null;
}

/** Изменение к прошлому периоду в процентах; `null`, если сравнивать не с чем */
export function deltaPercent(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Подпись загрузки/гостей карточки по направлению */
export const GUESTS_LABEL: Record<OverviewVertical, string> = {
  HOSPITALITY: 'Гостей в заездах',
  BEAUTY: 'Клиентов за месяц',
  FOOD_SERVICE: 'Гостей за месяц',
};

/** Подпись для журнала: известные действия словами, остальные в ленту не попадают (`null`) */
export function activityLabel(action: string, after: unknown): { label: string; detail: string | null } | null {
  const a = (after && typeof after === 'object' ? after : {}) as Record<string, unknown>;
  const name = typeof a.name === 'string' ? a.name : null;
  switch (action) {
    case 'organization.created':
      return { label: 'Новая организация', detail: name };
    case 'property.branch_created':
      return { label: 'Новый филиал', detail: name };
    case 'location.salon_created':
      return { label: 'Новый филиал', detail: name };
    case 'organization.status_changed':
      return {
        label: a.status === 'ACTIVE' ? 'Оплата получена' : 'Доступ только для чтения',
        detail: null,
      };
    case 'extension.updated':
      return { label: 'Изменено расширение', detail: 'ИИ-продавец' };
    case 'site_builder.entitlement_updated':
      return { label: 'Изменена лицензия конструктора сайта', detail: null };
    case 'hotel.settings.updated':
      return { label: 'Изменены настройки', detail: null };
    case 'reservation.create':
      return { label: 'Новая бронь', detail: null };
    case 'reservation.cancel':
      return { label: 'Отмена брони', detail: null };
    default:
      return null;
  }
}
