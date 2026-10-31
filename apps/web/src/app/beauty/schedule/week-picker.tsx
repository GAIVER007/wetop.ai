'use client';
import Link from 'next/link';
import { Select } from '../../../components/ui';
import { useLocale, useT } from '../../../i18n/locale-provider';
import { intlLocale } from '../../../i18n';
import { mondayOf, monthStarts, shiftWeek, weekDates } from './week';

/**
 * Выбор недели графика (владелец 31.10.2026: «добавь выбор месяца… чтобы видеть график на следующую неделю, удобный
 * выбор, и в салонах, и в гостиницах»): ‹ неделя ›, «Эта неделя», «Следующая» и месяц списком. Неделя в адресе `?week=`.
 */
export function WeekPicker({ base, monday, today, extra = '' }: { base: string; monday: string; today: string; extra?: string }) {
  const t = useT();
  const locale = intlLocale(useLocale());
  const href = (week: string) => `${base}?week=${week}${extra}`;
  const days = weekDates(monday);
  const dayMonth = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const monthName = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const label = (date: string) => dayMonth.format(new Date(`${date}T12:00:00Z`));
  const current = mondayOf(today);
  const next = shiftWeek(current, 7);
  const months = monthStarts(today);
  // неделя с 1-м числом принадлежит новому месяцу, иначе месяцу её четверга
  const shown = (days.find((d) => d.date.endsWith('-01')) ?? days[3]!).date.slice(0, 7);
  return (
    <nav className="schedule-week" aria-label={t('Неделя')}>
      <Link className="btn btn--secondary btn--sm schedule-week__step" href={href(shiftWeek(monday, -7))} aria-label={t('Прошлая неделя')}>
        <span aria-hidden="true">‹</span>
      </Link>
      <span className="schedule-week__range" data-testid="beauty-week-range">
        {label(days[0]!.date)} – {label(days[6]!.date)}
      </span>
      <Link className="btn btn--secondary btn--sm schedule-week__step" href={href(shiftWeek(monday, 7))} aria-label={t('Следующая неделя')}>
        <span aria-hidden="true">›</span>
      </Link>
      <Link className="btn btn--secondary btn--sm" href={href(current)} aria-current={monday === current ? 'page' : undefined}>
        {t('Эта неделя')}
      </Link>
      <Link className="btn btn--secondary btn--sm" href={href(next)} aria-current={monday === next ? 'page' : undefined}>
        {t('Следующая')}
      </Link>
      <Select
        aria-label={t('Месяц')}
        value={shown}
        onChange={(e) => {
          const m = months.find((x) => x.month === e.currentTarget.value);
          // без роутера: тот же переход, что по ссылке ‹ ›, работает и в отрисовке на сервере
          if (m) window.location.assign(href(m.monday));
        }}
      >
        {!months.some((m) => m.month === shown) && <option value={shown}>{monthName.format(new Date(`${shown}-01T12:00:00Z`))}</option>}
        {months.map((m) => (
          <option key={m.month} value={m.month}>
            {monthName.format(new Date(`${m.month}-01T12:00:00Z`))}
          </option>
        ))}
      </Select>
    </nav>
  );
}
