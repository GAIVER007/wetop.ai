'use client';
import Link from 'next/link';
import { Icon } from '../../components/icon';
import { useLocale, useT } from '../../i18n/locale-provider';
import { intlLocale } from '../../i18n';
import { displayDate } from '../../lib/display-date';
import { foodStatus } from '../../lib/status/food';
import type { RestaurantReservation } from '../../lib/food-types';
import { localInput } from '../beauty/time';
import { monthGrid, shiftMonth } from '../beauty/month-grid';
import '../beauty/beauty.css';

/** в клетке дня видно не больше трёх броней, остальные «ещё N», как месяц салона (эскиз А, 26.10.2026) */
const SHOWN = 3;
/** полоса статуса тоном реестра: те же классы, что у месяца салона */
const CHIP: Record<RestaurantReservation['status'], string> = {
  BOOKED: 'booked',
  CONFIRMED: 'confirmed',
  SEATED: 'in_progress',
  COMPLETED: 'done',
  NO_SHOW: 'no_show',
  CANCELLED: 'cancelled',
};

/** ссылка расписания: день (шкала) или месяц */
export const scheduleHref = (date: string, month: boolean) =>
  `/table-reservations?date=${date}${month ? '&view=month' : ''}`;

/**
 * Вид «Месяц» расписания броней столов (владелец 26.10.2026: месяц во всех вертикалях, как журнал салона).
 * Сетка 7 × 5–6 с понедельника, брони временем и именем, цвет полосы по статусу, число броней дня, «ещё N»,
 * сегодня в рамке, дни соседних месяцев приглушены. Номер дня открывает шкалу этого дня.
 */
export function MonthBoard({
  date,
  today,
  timezone,
  reservations,
  onOpen,
}: {
  date: string;
  today: string;
  timezone: string;
  /** брони сетки месяца одним запросом `reservations?date&dateTo`, уже с отборами экрана */
  reservations: RestaurantReservation[];
  onOpen: (r: RestaurantReservation) => void;
}) {
  const t = useT();
  const locale = intlLocale(useLocale());
  const grid = monthGrid(date);
  const byDay = new Map<string, RestaurantReservation[]>();
  for (const r of reservations) {
    const day = localInput(r.startsAt, timezone).slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), r]);
  }
  const name = (r: RestaurantReservation) =>
    [r.customer.firstName, r.customer.lastName].filter(Boolean).join(' ');
  const clock = (iso: string) => localInput(iso, timezone).slice(11);
  const monthTitle = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${grid.month}-15T12:00:00Z`));
  const weekdays = grid.days.slice(0, 7).map((d) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`)),
  );
  return (
    <div data-testid="food-month">
      <div className="board-period day-nav" role="group" aria-label={t('Месяц журнала')}>
        <Link href={scheduleHref(shiftMonth(date, -1), true)} className="icon-button" aria-label={t('Предыдущий месяц')}>
          <Icon name="chevron" className="rotate-left" />
        </Link>
        <span className="beauty-month__title" data-testid="food-month-title">
          {monthTitle}
        </span>
        <Link href={scheduleHref(shiftMonth(date, 1), true)} className="icon-button" aria-label={t('Следующий месяц')}>
          <Icon name="chevron" />
        </Link>
      </div>
      <div className="beauty-month-weekdays" aria-hidden="true">
        {weekdays.map((w, i) => (
          <span key={i} className={i > 4 ? 'is-weekend' : undefined}>
            {w}
          </span>
        ))}
      </div>
      <div className="beauty-month-calendar" role="list" aria-label={t('Месяц журнала')} data-weeks={grid.days.length / 7}>
        {grid.days.map((day, index) => {
          const rows = byDay.get(day) ?? [];
          const live = rows.filter((r) => r.status !== 'CANCELLED').length;
          const classes = [
            'beauty-month-day',
            day.slice(0, 7) !== grid.month ? 'is-other' : '',
            index % 7 > 4 ? 'is-weekend' : '',
            day === today ? 'is-today' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <div key={day} role="listitem" className={classes} aria-label={displayDate(day, 'full', locale)}>
              <Link
                className="beauty-month-day__head"
                href={scheduleHref(day, false)}
                prefetch={false}
                aria-label={t('Открыть день: {date}', { date: displayDate(day, 'full', locale) })}
                aria-current={day === today ? 'date' : undefined}
              >
                <b className="beauty-month-day__num">{Number(day.slice(8, 10))}</b>
                {live > 0 && <span className="beauty-month-day__count">{live}</span>}
              </Link>
              {rows.length > 0 && (
                <ul className="beauty-month-appointments">
                  {rows.slice(0, SHOWN).map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        className={`beauty-month-chip beauty-week-chip--${CHIP[r.status]}`}
                        title={[`${clock(r.startsAt)}–${clock(r.endsAt)}`, name(r), r.table?.name, t(foodStatus[r.status].label)].filter(Boolean).join(', ')}
                        onClick={() => onOpen(r)}
                      >
                        <time dateTime={r.startsAt}>{clock(r.startsAt)}</time>
                        <b>{name(r)}</b>
                        <span className="sr-only">
                          {[r.table?.name, t(foodStatus[r.status].label)].filter(Boolean).join(', ')}
                        </span>
                      </button>
                    </li>
                  ))}
                  {rows.length > SHOWN && (
                    <li>
                      <Link className="beauty-month-more" prefetch={false} href={scheduleHref(day, false)}>
                        {t('ещё {n}', { n: rows.length - SHOWN })}
                      </Link>
                    </li>
                  )}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
