import { Icon } from '../../components/icon';
import { intlLocale, translator, type DeskLocale } from '../../i18n';
import { dateFormat } from '../../i18n/dates';

const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь']; // kk-allow: русская подпись как была («октябрь 2026», со строчной), другие языки из dateFormat

/**
 * `2026-10` → «октябрь 2026»: подпись своя, родное поле месяца писало «October 2026» (аудит 22.10.2026, P1-1b).
 * Казахский и английский берут месяц и порядок из `dateFormat` (KK3).
 */
export function monthLabel(month: string, locale: DeskLocale = 'ru'): string {
  const index = Number(month.slice(5, 7)) - 1;
  if (locale === 'ru' || !(index >= 0 && index <= 11)) return `${MONTHS[index] ?? month.slice(5, 7)} ${month.slice(0, 4)}`;
  return dateFormat(intlLocale(locale), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(Number(month.slice(0, 4)), index, 1)),
  );
}

export function shiftMonth(month: string, offset: number): string {
  const date = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Месяц отчёта: «‹ октябрь 2026 ›», стрелки — ссылки с тем же параметром `?month=`. */
export function MonthPicker({ month, locale = 'ru' }: { month: string; locale?: DeskLocale }) {
  const t = translator(locale);
  const previous = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  return (
    <nav className="org-month" aria-label={t('Месяц отчёта')}>
      <a href={`/branches?month=${previous}`} aria-label={t('Предыдущий месяц: {month}', { month: monthLabel(previous, locale) })}>
        <Icon name="back" />
      </a>
      <span className="org-month__label" aria-current="date">
        {monthLabel(month, locale)}
      </span>
      <a href={`/branches?month=${next}`} aria-label={t('Следующий месяц: {month}', { month: monthLabel(next, locale) })}>
        <Icon name="arrow" />
      </a>
    </nav>
  );
}
