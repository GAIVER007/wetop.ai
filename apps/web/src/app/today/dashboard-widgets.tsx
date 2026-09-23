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
 * выше, — второго источника правды не заводим. Есть дела — кнопка открывает выбор брони дня.
 *
 * Дел нет — кнопка не гаснет, а ведёт туда, где действие начинается, и говорит куда: в пустой день
 * она нужнее всего (гость пришёл с улицы, бронь пришла в экстранет канала — её надо завести). Сначала
 * ноль гасил кнопку, и на рабочей базе без броней на сегодня стойка осталась с пятью мёртвыми
 * кнопками (снимок владельца, 23.09.2026).
 */
type QuickAction = {
  label: string;
  icon: IconName;
  count: number;
  /** куда ведёт кнопка, когда дел нет, и как это сказать словами */
  idle: { href: string; hint: string };
};

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
  const findBooking = (why: string) => ({ href: '/reservations', hint: `${why} — найти бронь` });
  const options: QuickAction[] = [
    {
      label: 'Заселить гостя',
      icon: 'arrival',
      count: day.counts.toCheckIn,
      idle: { href: '/reservations/new', hint: 'нет заездов — новая бронь' },
    },
    {
      label: 'Выселить гостя',
      icon: 'departure',
      count: day.counts.toCheckOut,
      idle: findBooking('нет выездов'),
    },
    {
      label: 'Продлить проживание',
      icon: 'clock',
      count: day.counts.inHouse,
      idle: findBooking('никто не проживает'),
    },
    {
      label: 'Переселить',
      icon: 'bed',
      count: day.counts.inHouse,
      idle: findBooking('никто не проживает'),
    },
    {
      label: 'Создать счёт',
      icon: 'receipt',
      count: dayCount,
      idle: findBooking('нет броней дня'),
    },
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
        {options.map((option) => {
          const icon = (
            <span className="quick-action__icon">
              <Icon name={option.icon} />
            </span>
          );
          return option.count > 0 ? (
            <button
              className="quick-action"
              key={option.label}
              onClick={() => {
                setQuery('');
                setAction(option.label);
              }}
            >
              {icon}
              <span className="quick-action__text">
                <span className="quick-action__label">{option.label}</span>
              </span>
              <span className="quick-action__count">{option.count}</span>
            </button>
          ) : (
            <Link className="quick-action" key={option.label} href={option.idle.href}>
              {icon}
              <span className="quick-action__text">
                <span className="quick-action__label">{option.label}</span>
                <span className="quick-action__hint">{option.idle.hint}</span>
              </span>
            </Link>
          );
        })}
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
