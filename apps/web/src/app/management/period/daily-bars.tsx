'use client';
import { useState } from 'react';
import type { DashboardDailyPoint } from '@pms/domain';
import { Button, cx } from '../../../components/ui';
import { Icon } from '../../../components/icon';
import { formatPercent } from '../../../lib/dashboard-format';
import { displayDate } from '../../../lib/display-date';

const dayOfMonth = (iso: string) => Number(iso.slice(8, 10));
const weekend = (iso: string) => [0, 6].includes(new Date(`${iso}T00:00:00Z`).getUTCDay());

/** Подробности дня словами — то, что раньше жило только в `title` столбика */
function dayFacts(d: DashboardDailyPoint) {
  return `занято ${d.occupied} (${formatPercent(d.percent)}), свободно ${d.free}${
    d.blocked ? `, закрыто ${d.blocked}` : ''
  }, заезды ${d.arrivals}, выезды ${d.departures}`;
}

/**
 * Столбики загрузки по дням с подписью выбранного дня (разбор 23.09.2026, находка 8; DESIGN.md §8,
 * «График загрузки по дням»). Раньше подробности дня были только в `title` — ни с клавиатуры, ни
 * касанием их не открыть (§15). Теперь день выбирается наведением, щелчком или касанием столбика и
 * кнопками «Предыдущий день» / «Следующий день» (≥ 30 px — столбик месяца уже 24 px, поэтому
 * кнопки, а не фокус на каждом столбике: §11); подпись дня видна всегда. По умолчанию — сегодня,
 * если он в отрезке, иначе последний день.
 */
export function DailyBars({ days, today }: { days: DashboardDailyPoint[]; today: string }) {
  const todayIndex = days.findIndex((d) => d.date === today);
  const [active, setActive] = useState(todayIndex >= 0 ? todayIndex : days.length - 1);
  const dense = days.length > 31;
  const day = days[active];
  return (
    <>
      {/* Для программы чтения столбики — ряд чисел без смысла: день она узнаёт из подписи под графиком */}
      <div className={cx('bars', dense && 'bars--dense')} data-testid="chart-daily" aria-hidden="true">
        {days.map((d, i) => (
          <div
            key={d.date}
            className={cx(
              'bar',
              d.date === today && 'is-today',
              d.date > today && 'is-future',
              weekend(d.date) && 'is-weekend',
              i === active && 'is-active',
            )}
            // мышь и касание — удобство; тот же выбор с клавиатуры делают кнопки под графиком
            onMouseEnter={() => setActive(i)}
            onClick={() => setActive(i)}
          >
            <i style={{ height: `${d.percent}%` }} />
            <span>{!dense || i === 0 || dayOfMonth(d.date) % 5 === 0 ? dayOfMonth(d.date) : ''}</span>
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
            aria-label="Предыдущий день"
            disabled={active === 0}
            onClick={() => setActive(active - 1)}
          >
            <Icon name="chevron" width={16} height={16} />
          </Button>
          <p data-testid="chart-day" aria-live="polite">
            <strong>{displayDate(day.date, 'full')}</strong>
            {day.date > today && <span className="muted">, по броням</span>}
            <span>: {dayFacts(day)}</span>
          </p>
          <Button
            type="button"
            tone="secondary"
            size="sm"
            aria-label="Следующий день"
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
