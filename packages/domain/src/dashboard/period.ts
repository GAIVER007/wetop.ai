/**
 * Период дашборда: готовые отрезки от сегодняшнего дня объекта или свой отрезок.
 * Даты — stay DATE (YYYY-MM-DD) в часах объекта; сегодняшний день сюда передают снаружи.
 */
export type PeriodPreset = 'today' | 'yesterday' | 'week' | 'month' | 'last-month' | 'custom';
export const PERIOD_PRESETS: ReadonlyArray<{ id: PeriodPreset; label: string }> = [
  { id: 'today', label: 'Сегодня' },
  { id: 'yesterday', label: 'Вчера' },
  { id: 'week', label: '7 дней' },
  { id: 'month', label: 'Этот месяц' },
  { id: 'last-month', label: 'Прошлый месяц' },
];
/** Как отчёт по каналам: до 366 дней включительно */
export const MAX_PERIOD_DAYS = 366;

export interface ResolvedPeriod {
  preset: PeriodPreset;
  from: string;
  to: string;
  /** Почему свой отрезок не принят и показан сегодняшний день */
  error?: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** Дата stay DATE; общая проверка `isIsoDate` есть в web-analytics, здесь нужна только своя узкая */
const isIsoDate = (v: string | undefined): v is string =>
  !!v && ISO.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const addDays = (iso: string, n: number) => {
  const x = new Date(`${iso}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const monthBounds = (iso: string, shift: number) => {
  const [y, m] = iso.split('-').map(Number) as [number, number];
  const first = new Date(Date.UTC(y, m - 1 + shift, 1));
  const last = new Date(Date.UTC(y, m + shift, 0));
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
};
export const periodNights = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;

export function resolvePeriod(
  q: { preset?: string | undefined; from?: string | undefined; to?: string | undefined; date?: string | undefined },
  today: string,
): ResolvedPeriod {
  const fallback = (error?: string): ResolvedPeriod => ({
    preset: 'today',
    from: today,
    to: today,
    ...(error ? { error } : {}),
  });
  if (!q.preset && isIsoDate(q.date)) return { preset: 'custom', from: q.date, to: q.date };
  switch (q.preset) {
    case 'yesterday':
      return { preset: 'yesterday', from: addDays(today, -1), to: addDays(today, -1) };
    case 'week':
      return { preset: 'week', from: addDays(today, -6), to: today };
    case 'month':
      return { preset: 'month', ...monthBounds(today, 0) };
    case 'last-month':
      return { preset: 'last-month', ...monthBounds(today, -1) };
    case 'custom': {
      if (!isIsoDate(q.from) || !isIsoDate(q.to)) return fallback('Введите обе даты периода');
      if (q.to < q.from) return fallback('Окончание периода не может быть раньше начала');
      if (periodNights(q.from, q.to) > MAX_PERIOD_DAYS)
        return fallback(`Период не больше ${MAX_PERIOD_DAYS} дней`);
      return { preset: 'custom', from: q.from, to: q.to };
    }
    default:
      return fallback();
  }
}

/** Предыдущий отрезок той же длины, впритык к началу текущего — для сравнения на реальных числах */
export function previousPeriod(from: string, to: string): { from: string; to: string } {
  const n = periodNights(from, to);
  return { from: addDays(from, -n), to: addDays(from, -1) };
}
