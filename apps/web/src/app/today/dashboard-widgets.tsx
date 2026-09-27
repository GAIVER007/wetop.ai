'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { DeskDay, DeskRow } from '../../lib/api';
import { Icon, type IconName } from '../../components/icon';
import { Overlay } from '../../components/overlay';
import { displayDate } from '../../lib/display-date';
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
 * Быстрое действие знает, сколько дел под ним лежит, и окно выбора показывает ровно эти дела: число на
 * кнопке и строки окна — один список. Всё берётся из того же `DeskDay`, что и плитки выше, — второго
 * источника правды не заводим.
 *
 * Разбор 23.09.2026 (находка 1): число считалось одним фильтром, а окно — другим. «Выселить гостя 1»
 * открывал две строки, и вторая — уже выселенный гость; «Продлить проживание 3» — восемь, среди них ещё не
 * заехавшие; просроченного заезда в «Заселить гостя» не было вовсе. Теперь строка окна — проживание, с
 * которым это действие можно сделать сегодня, а ссылка ведёт к кнопке этого действия на карточке брони
 * (находка 2: `?do=…&item=…`, фокус на кнопке — нажимает по-прежнему человек).
 *
 * Дел нет — кнопка не гаснет, а ведёт туда, где действие начинается, и говорит куда: в пустой день
 * она нужнее всего (гость пришёл с улицы, бронь пришла в экстранет канала — её надо завести). Сначала
 * ноль гасил кнопку, и на рабочей базе без броней на сегодня стойка осталась с пятью мёртвыми
 * кнопками (снимок владельца, 23.09.2026).
 */
type QuickTarget = 'check-in' | 'check-out' | 'extend' | 'move';
type QuickAction = {
  label: string;
  icon: IconName;
  /** проживания, с которыми это действие можно сделать в этот день, — они же строки окна выбора */
  rows: DeskRow[];
  /** кнопка действия на карточке брони; `finance` — раздел «Счета» */
  target: QuickTarget | 'finance';
  /** «Создать счёт» числа не показывает: любая бронь дня — не дело */
  counted: boolean;
  /** куда ведёт кнопка, когда дел нет, и как это сказать словами */
  idle: { href: string; hint: string };
};

const awaited = (r: DeskRow) => r.status === 'CONFIRMED' || r.status === 'TENTATIVE';
const living = (r: DeskRow) => r.status === 'CHECKED_IN';
/** Одно проживание — одна строка: у групповой брони дела у каждого места свои */
const byStay = (rows: DeskRow[]) => [...new Map(rows.map((r) => [r.itemId, r])).values()];

function quickActions(day: DeskDay): QuickAction[] {
  // Живут сейчас — и те, кто уезжает сегодня: продлевают и переселяют чаще всего именно их
  const livingNow = byStay([...day.inHouse, ...day.departures.filter(living)]);
  const findBooking = (why: string) => ({ href: '/reservations', hint: `${why} — найти бронь` });
  return [
    {
      label: 'Заселить гостя',
      icon: 'arrival',
      rows: byStay([...day.arrivals.filter(awaited), ...day.overdueArrivals]),
      target: 'check-in',
      counted: true,
      idle: { href: '/reservations/new', hint: 'нет заездов — новая бронь' },
    },
    {
      label: 'Выселить гостя',
      icon: 'departure',
      rows: byStay(day.departures.filter(living)),
      target: 'check-out',
      counted: true,
      idle: findBooking('нет выездов'),
    },
    {
      label: 'Продлить проживание',
      icon: 'clock',
      rows: livingNow,
      target: 'extend',
      counted: true,
      idle: findBooking('никто не проживает'),
    },
    {
      label: 'Переселить',
      icon: 'bed',
      rows: livingNow,
      target: 'move',
      counted: true,
      idle: findBooking('никто не проживает'),
    },
    {
      label: 'Создать счёт',
      icon: 'receipt',
      // «Счета» — раздел брони, а не проживания: одна строка на бронь
      rows: [
        ...new Map(
          [...day.inHouse, ...day.arrivals, ...day.departures].map((r) => [
            r.confirmationNumber,
            r,
          ]),
        ).values(),
      ],
      target: 'finance',
      counted: false,
      idle: findBooking('нет броней дня'),
    },
  ];
}

function cardHref(action: QuickAction, r: DeskRow) {
  const card = `/reservations/${encodeURIComponent(r.confirmationNumber)}`;
  return action.target === 'finance'
    ? `${card}#booking-finance`
    : `${card}?do=${action.target}&item=${encodeURIComponent(r.itemId)}#booking-actions`;
}

export function QuickActions({ day }: { day: DeskDay }) {
  const [label, setLabel] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const options = quickActions(day);
  const action = options.find((o) => o.label === label) ?? null;
  const overdue = new Set(day.overdueArrivals.map((r) => r.itemId));
  const q = query.trim().toLocaleLowerCase('ru');
  const found = (action?.rows ?? []).filter((r) =>
    `${r.guestLabel} ${r.unitCode ?? ''} ${r.confirmationNumber}`
      .toLocaleLowerCase('ru')
      .includes(q),
  );
  return (
    <section className="quick-actions-card" aria-label="Быстрые действия" data-tour="quick-actions">
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
          return option.rows.length > 0 ? (
            <button
              className="quick-action"
              key={option.label}
              onClick={() => {
                setQuery('');
                setLabel(option.label);
              }}
            >
              {icon}
              <span className="quick-action__text">
                <span className="quick-action__label">{option.label}</span>
              </span>
              {option.counted && (
                <span className="quick-action__count">{option.rows.length}</span>
              )}
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
      <Overlay open={!!action} onClose={() => setLabel(null)} title={label ?? 'Выбор брони'}>
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
          {action &&
            found.map((r) => (
              <Link href={cardHref(action, r)} key={r.itemId} onClick={() => setLabel(null)}>
                <span className="round-icon">
                  <Icon name="guests" />
                </span>
                <span>
                  <strong>{r.guestLabel}</strong>
                  {/* ячейка, номер брони и опоздание — отдельными метками, без точки-разделителя (§14) */}
                  <small>
                    <span className="mono">{r.unitCode ?? '—'}</span>
                    <span className="booking-number">{r.confirmationNumber}</span>
                    {overdue.has(r.itemId) && (
                      <span>заезд был {displayDate(r.arrivalDate)}</span>
                    )}
                  </small>
                </span>
                <Icon name="chevron" />
              </Link>
            ))}
          {!found.length && (
            <div className="empty-state">
              <Icon name="booking" />
              <h3>Нет подходящих броней</h3>
              <p>Выберите другой день или найдите бронь по номеру.</p>
              <Link
                href="/reservations"
                className="btn btn--secondary"
                onClick={() => setLabel(null)}
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
