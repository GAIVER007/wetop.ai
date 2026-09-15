'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Chessboard, DeskDay } from '../../lib/api';
import { Icon, type IconName } from '../../components/icon';
import { Overlay } from '../../components/overlay';
export function HotelClock({ timezone }: { timezone: string }) {
  const [time, setTime] = useState('');
  useEffect(() => {
    const update = () =>
      setTime(
        new Intl.DateTimeFormat('ru', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: timezone,
        }).format(new Date()),
      );
    update();
    const timer = setInterval(update, 30_000);
    return () => clearInterval(timer);
  }, [timezone]);
  return (
    <span className="hotel-clock">
      <Icon name="clock" width={14} />
      {time || '—'} <span>Время гостиницы</span>
    </span>
  );
}
export function QuickActions({ day }: { day: DeskDay }) {
  const [action, setAction] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const rows =
    action === 'Заселить гостя'
      ? day.arrivals
      : action === 'Выселить гостя'
        ? day.departures
        : [...day.inHouse, ...day.arrivals, ...day.departures];
  const unique = [...new Map(rows.map((r) => [r.confirmationNumber, r])).values()].filter((r) =>
    `${r.guestLabel} ${r.unitCode} ${r.confirmationNumber}`
      .toLocaleLowerCase('ru')
      .includes(query.trim().toLocaleLowerCase('ru')),
  );
  const options: Array<[string, IconName]> = [
    ['Заселить гостя', 'arrival'],
    ['Выселить гостя', 'departure'],
    ['Продлить проживание', 'clock'],
    ['Переселить', 'bed'],
    ['Создать счёт', 'receipt'],
  ];
  return (
    <section className="quick-actions-card">
      <div className="card-heading">
        <h2>Быстрые действия</h2>
        <Icon name="plus" width={16} />
      </div>
      <div className="quick-actions-grid">
        <Link href="/reservations/new" className="quick-action quick-action--primary">
          <Icon name="plus" />
          <span>Новая бронь</span>
        </Link>
        {options.map(([label, icon]) => (
          <button
            className="quick-action"
            key={label}
            onClick={() => {
              setQuery('');
              setAction(label);
            }}
          >
            <Icon name={icon} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <Overlay open={!!action} onClose={() => setAction(null)} title={action ?? 'Выбор брони'}>
        <label className="field">
          Выберите бронирование
          <input
            className="inp"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Гость, номер или бронь"
          />
        </label>
        <div className="assistant-results">
          {unique.map((r) => (
            <Link
              href={`/reservations/${encodeURIComponent(r.confirmationNumber)}#${action === 'Создать счёт' ? 'booking-finance' : 'booking-actions'}`}
              key={r.confirmationNumber}
              onClick={() => setAction(null)}
            >
              <span className="round-icon">
                <Icon name="guests" />
              </span>
              <span>
                <strong>{r.guestLabel}</strong>
                <small>
                  {r.unitCode ?? 'Без номера'}, {r.confirmationNumber}
                </small>
              </span>
              <Icon name="chevron" />
            </Link>
          ))}
          {!unique.length && (
            <div className="empty-state">
              <Icon name="booking" />
              <h3>Нет подходящих броней</h3>
              <p>Выберите другой день или найдите бронь по номеру.</p>
              <Link
                href="/reservations"
                className="btn btn--secondary"
                onClick={() => setAction(null)}
              >
                Все брони
              </Link>
            </div>
          )}
        </div>
      </Overlay>
    </section>
  );
}
/** Загрузка объекта на дату: занято / свободно / недоступно, как их считает шахматка. Без графиков — стойке они не нужны. */
export function OccupancyRing({ board, date }: { board: Chessboard | null; date: string }) {
  if (!board)
    return (
      <section className="panel">
        <p className="muted">Не удалось загрузить статистику размещения.</p>
        <Link href="/management/statistics">Открыть статистику</Link>
      </section>
    );
  const summary = board.summary[date] ?? { occupied: 0, free: 0, blocked: 0 };
  const total = summary.occupied + summary.free + summary.blocked;
  const percent = total ? Math.round((summary.occupied / total) * 100) : 0;
  return (
    <section className="chart-card">
      <div className="card-heading">
        <h2>Загрузка объекта</h2>
        <Link href="/management/statistics" aria-label="Статистика загрузки">
          <Icon name="external" width={16} />
        </Link>
      </div>
      <div className="occupancy-content">
        <div
          className="occupancy-ring"
          style={{
            background: `conic-gradient(var(--primary) ${percent}%, var(--border-soft) 0)`,
          }}
          role="img"
          aria-label={`Занято ${percent}% единиц продажи`}
        >
          <div>
            <strong>
              {percent}
              <small>%</small>
            </strong>
            <span>Загружено</span>
          </div>
        </div>
        <div className="chart-legend">
          <div>
            <i className="legend-blue" />
            Занято<strong>{summary.occupied}</strong>
          </div>
          <div>
            <i className="legend-green" />
            Свободно<strong>{summary.free}</strong>
          </div>
          <div>
            <i className="legend-gray" />
            Недоступно<strong>{summary.blocked}</strong>
          </div>
          <small>{total} номеров и койко-мест</small>
        </div>
      </div>
    </section>
  );
}
