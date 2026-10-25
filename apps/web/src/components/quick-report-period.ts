import { intlLocale, translator, type DeskLocale, type Translate } from '../i18n';
import { dateFormat } from '../i18n/dates';

/** Периоды быстрого отчёта салона: чистые даты в поясе филиала, без часов и без обращения к API. */
export type PeriodKind = 'day' | 'week' | 'month' | 'prevMonth' | 'custom';
export const MAX_PERIOD_DAYS = 62;
const DAY = 86_400_000;

const parse = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
};
const iso = (date: Date) => date.toISOString().slice(0, 10);
const utc = (year: number, month: number, day: number) => new Date(Date.UTC(year, month, day));

export function periodRange(kind: Exclude<PeriodKind, 'custom'>, date: string) {
  const at = parse(date) ?? new Date();
  const year = at.getUTCFullYear();
  const month = at.getUTCMonth();
  if (kind === 'day') return { from: iso(at), to: iso(at) };
  if (kind === 'week') {
    const monday = new Date(at.getTime() - ((at.getUTCDay() + 6) % 7) * DAY);
    return { from: iso(monday), to: iso(new Date(monday.getTime() + 6 * DAY)) };
  }
  const first = kind === 'month' ? month : month - 1;
  return { from: iso(utc(year, first, 1)), to: iso(utc(year, first + 1, 0)) };
}

/** Все дни периода включительно; null, если даты неверны, перевёрнуты или период длиннее лимита. */
export function periodDays(from: string, to: string): string[] | null {
  const start = parse(from);
  const end = parse(to);
  if (!start || !end || start > end) return null;
  const count = Math.round((end.getTime() - start.getTime()) / DAY) + 1;
  if (count > MAX_PERIOD_DAYS) return null;
  return Array.from({ length: count }, (_, i) => iso(new Date(start.getTime() + i * DAY)));
}

/** Заголовок периода на языке человека: месяцы по `locale`, слова через `t`; без них русский, как раньше */
export function periodTitle(
  from: string,
  to: string,
  t: Translate = translator('ru'),
  locale: DeskLocale = 'ru',
): string {
  const short = (date: Date) =>
    dateFormat(intlLocale(locale), { month: 'short', timeZone: 'UTC' }).format(date);
  const start = parse(from);
  const end = parse(to);
  if (!start || !end) return t('Статистика');
  const year = end.getUTCFullYear();
  const period =
    from === to
      ? `${start.getUTCDate()} ${short(start)} ${year}`
      : start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === year
        ? `${start.getUTCDate()}–${end.getUTCDate()} ${short(end)} ${year}`
        : `${start.getUTCDate()} ${short(start)} – ${end.getUTCDate()} ${short(end)} ${year}`;
  return t('Статистика за {period}', { period });
}
