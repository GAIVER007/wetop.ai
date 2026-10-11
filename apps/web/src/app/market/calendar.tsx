import Link from 'next/link';
import { formatOccupancy } from '@pms/domain';
import { displayDate } from '../../lib/display-date';
import { cx } from '../../components/ui';
import type { Signal, SignalCell } from './derive';

export const SIGNAL_WORD: Record<Signal, string> = {
  high: 'высокий спрос',
  mid: 'обычный спрос',
  low: 'слабый спрос',
  shift: 'резкое изменение',
  none: 'нет данных',
};

const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
/** колонка дня недели: понедельник первый */
const column = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
const pct = (bp: number | null) => (bp === null ? '–' : formatOccupancy(Math.round(bp / 100) * 100));

/**
 * «Календарь рыночных сигналов» (COMP3.2, ТЗ §5): даты окна сеткой недели, в ячейке день, своя
 * загрузка и цвет сигнала рынка. Цвет не единственный носитель: слово сигнала в доступном имени
 * ячейки и в легенде. Щелчок по дате открывает «Историю ночи» (`?night=`), как шапка таблицы.
 */
export function SignalCalendar({
  cells,
  nightHref,
}: {
  cells: SignalCell[];
  nightHref: (date: string) => string;
}) {
  const first = cells[0];
  if (!first) return null;
  const offset = column(first.date);
  return (
    <div className="market-calendar" data-testid="market-calendar">
      <ul className="market-calendar__week" aria-hidden="true">
        {WEEKDAYS.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
      <ul className="market-calendar__grid">
        {cells.map((c, i) => (
          <li
            key={c.date}
            className={cx('market-day', `market-day--${c.signal}`)}
            style={i === 0 ? { gridColumnStart: offset + 1 } : undefined /* slop-allow: inline-style колонка первого дня из даты */}
          >
            <Link
              href={nightHref(c.date)}
              scroll={false}
              data-testid={`market-day-${c.date}`}
              aria-label={`${displayDate(c.date, 'numeric')}: рынок ${SIGNAL_WORD[c.signal]}, у вас ${pct(c.ownBp)}`}
            >
              <span className="market-day__num">{Number(c.date.slice(8, 10))}</span>
              <span className="market-day__own" aria-hidden="true">
                {pct(c.ownBp)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <ul className="market-legend" aria-label="Цвет даты">
        <li>
          <span className="market-swatch market-day--high" aria-hidden="true" />
          высокий спрос
        </li>
        <li>
          <span className="market-swatch market-day--mid" aria-hidden="true" />
          обычный
        </li>
        <li>
          <span className="market-swatch market-day--low" aria-hidden="true" />
          слабый
        </li>
        <li>
          <span className="market-swatch market-day--shift" aria-hidden="true" />
          резкое изменение
        </li>
        <li>
          <span className="market-swatch market-day--none" aria-hidden="true" />
          нет данных
        </li>
      </ul>
    </div>
  );
}
