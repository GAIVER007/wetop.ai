'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { DeskDay } from '../../lib/api';
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
/*
 * Быстрое действие знает, сколько дел под ним лежит: число берётся из того же `DeskDay`, что и плитки
 * выше, — второго источника правды не заводим. Ноль дел гасит кнопку и говорит словами, почему:
 * прежде она открывала окно выбора с пустым списком, и это был тупик (23.09.2026).
 */
type QuickAction = { label: string; icon: IconName; count: number; empty: string };

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
  // Счёт всех броней дня — для действий, которые не привязаны к заезду или выезду
  const dayCount = new Map(
    [...day.inHouse, ...day.arrivals, ...day.departures].map((r) => [r.confirmationNumber, r]),
  ).size;
  const options: QuickAction[] = [
    { label: 'Заселить гостя', icon: 'arrival', count: day.counts.toCheckIn, empty: 'нет заездов' },
    {
      label: 'Выселить гостя',
      icon: 'departure',
      count: day.counts.toCheckOut,
      empty: 'нет выездов',
    },
    {
      label: 'Продлить проживание',
      icon: 'clock',
      count: day.counts.inHouse,
      empty: 'никто не проживает',
    },
    { label: 'Переселить', icon: 'bed', count: day.counts.inHouse, empty: 'никто не проживает' },
    { label: 'Создать счёт', icon: 'receipt', count: dayCount, empty: 'нет броней дня' },
  ];
  return (
    <section className="quick-actions-card" aria-label="Быстрые действия">
      <div className="card-heading">
        <h2>Быстрые действия</h2>
        <Link className="card-heading__link" href="/reservations">
          Все брони
          <Icon name="chevron" width={14} />
        </Link>
      </div>
      <div className="quick-actions-grid">
        {options.map((option) => (
          <button
            className="quick-action"
            key={option.label}
            disabled={option.count === 0}
            onClick={() => {
              setQuery('');
              setAction(option.label);
            }}
          >
            <span className="quick-action__icon">
              <Icon name={option.icon} />
            </span>
            <span className="quick-action__label">{option.label}</span>
            {option.count > 0 ? (
              <span className="quick-action__count">{option.count}</span>
            ) : (
              <span className="quick-action__empty">{option.empty}</span>
            )}
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
            autoFocus
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
                  {r.unitCode ?? '—'} · {r.confirmationNumber}
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
