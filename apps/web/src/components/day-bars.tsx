'use client';
import { useState, type ReactNode } from 'react';
import { Button, cx } from './ui';
import { Icon } from './icon';
import { displayDate } from '../lib/display-date';

export interface DayBar {
  /** Первый день столбика: у дневного графика единственный */
  date: string;
  /** Последний день столбика недели или месяца (RPT2.2c-3); у дневного графика не задаётся */
  to?: string;
  /** Подпись под столбиком вместо числа месяца (неделя, месяц) */
  label?: string;
  /** Высота столбика, 0–100 */
  height: number;
  /** Подробности дня словами — видны под графиком, когда день выбран */
  facts: ReactNode;
}

const dayOfMonth = (iso: string) => Number(iso.slice(8, 10));
const weekend = (iso: string) => [0, 6].includes(new Date(`${iso}T00:00:00Z`).getUTCDay());

/**
 * Столбики по дням с подписью выбранного дня — общий график «Аналитики» (ADR-114; DESIGN.md §8,
 * «График по дням»). Тот же приём, что у графика загрузки Главной (23.09): день выбирается наведением,
 * щелчком или касанием столбика и кнопками «Предыдущий день» / «Следующий день»; подпись дня видна
 * всегда, ряд столбиков для программы чтения скрыт — день она слышит из подписи. Классы `.bars*` —
 * общие (`components.css`), своих стилей у графика нет. По умолчанию выбран сегодняшний день,
 * если он в отрезке, иначе последний.
 */
export function DayBars({
  days,
  today,
  testId,
}: {
  days: DayBar[];
  today: string;
  testId: string;
}) {
  const todayIndex = days.findIndex((d) => d.date === today);
  const [active, setActive] = useState(todayIndex >= 0 ? todayIndex : days.length - 1);
  const dense = days.length > 31;
  const grouped = days.some((d) => d.to !== undefined);
  const day = days[active];
  return (
    <>
      <div className={cx('bars', dense && 'bars--dense')} data-testid={testId} aria-hidden="true">
        {days.map((d, i) => (
          <div
            key={d.date}
            className={cx(
              'bar',
              d.date <= today && today <= (d.to ?? d.date) && 'is-today',
              d.date > today && 'is-future',
              !grouped && weekend(d.date) && 'is-weekend',
              i === active && 'is-active',
            )}
            onMouseEnter={() => setActive(i)}
            onClick={() => setActive(i)}
          >
            <i style={{ height: `${Math.max(0, Math.min(100, d.height))}%` }} />
            <span>
              {d.label ??
                (!dense || i === 0 || dayOfMonth(d.date) % 5 === 0 ? dayOfMonth(d.date) : '')}
            </span>
          </div>
        ))}
      </div>
      {day && (
        <div className="bars-day">
          <Button
            type="button"
            tone="secondary"
            size="sm"
            className="bars-day__prev"
            aria-label={grouped ? 'Предыдущий период' : 'Предыдущий день'}
            disabled={active === 0}
            onClick={() => setActive(active - 1)}
          >
            <Icon name="chevron" width={16} height={16} />
          </Button>
          <p data-testid={`${testId}-day`} aria-live="polite">
            <strong>
              {day.to && day.to !== day.date
                ? `${displayDate(day.date)} — ${displayDate(day.to)}`
                : displayDate(day.date, 'full')}
            </strong>
            {day.date > today && <span className="muted">, по броням</span>}
            <span>: {day.facts}</span>
          </p>
          <Button
            type="button"
            tone="secondary"
            size="sm"
            aria-label={grouped ? 'Следующий период' : 'Следующий день'}
            disabled={active === days.length - 1}
            onClick={() => setActive(active + 1)}
          >
            <Icon name="chevron" width={16} height={16} />
          </Button>
        </div>
      )}
    </>
  );
}
