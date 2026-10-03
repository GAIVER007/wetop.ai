import type { ReactNode } from 'react';
import Link from 'next/link';
import type { Chessboard, DeskDay } from '../../lib/api';

/*
 * Три виджета «на сегодня» Главной владельца (03.10.2026, по образцу «Статистики» прежней PMS):
 * загрузка кольцом, движение гостей и состояние мест. Всё из уже загруженных `DeskDay` и шахматки
 * дня, новых запросов нет. Полоса под строкой — доля от всего фонда, чтобы числа сравнивались на глаз.
 */

/** Блокировки «с местом что-то не так», как у панели уборки (план A2 §3.3) */
const REPAIR = ['MAINTENANCE', 'OUT_OF_ORDER'];

type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'muted';

function Row({
  label,
  value,
  of,
  tone,
  href,
  id,
  note,
}: {
  label: string;
  value: number;
  /** база полосы: весь фонд */
  of: number;
  tone: Tone;
  href?: string;
  id?: string;
  note?: ReactNode | undefined;
}) {
  const width = of > 0 ? Math.min(100, Math.round((value * 100) / of)) : 0;
  const text = (
    <>
      <span className="tw-row__label">{label}</span>
      {note && <small>{note}</small>}
      <strong data-testid={id}>{value}</strong>
    </>
  );
  return (
    <li className={`tw-row tw-row--${tone}`}>
      {href ? <Link href={href}>{text}</Link> : <div>{text}</div>}
      <span className="tw-row__bar" aria-hidden="true">
        <span style={{ width: `${width}%` }} />
      </span>
    </li>
  );
}

function Ring({ occupied, blocked, total }: { occupied: number; blocked: number; total: number }) {
  const pct = total ? Math.round((occupied * 100) / total) : 0;
  const occ = total ? (occupied * 100) / total : 0;
  const blk = total ? (blocked * 100) / total : 0;
  return (
    <div className="tw-ring" data-testid="c-occupancy">
      <svg viewBox="0 0 42 42" aria-hidden="true">
        <circle className="tw-ring__free" cx="21" cy="21" r="16" pathLength={100} />
        <circle
          className="tw-ring__occupied"
          cx="21"
          cy="21"
          r="16"
          pathLength={100}
          strokeDasharray={`${occ} ${100 - occ}`}
        />
        {blk > 0 && (
          <circle
            className="tw-ring__blocked"
            cx="21"
            cy="21"
            r="16"
            pathLength={100}
            strokeDasharray={`${blk} ${100 - blk}`}
            strokeDashoffset={-occ}
          />
        )}
      </svg>
      <strong>{total ? `${pct} %` : '—'}</strong>
    </div>
  );
}

export function TodayWidgets({ day, board }: { day: DeskDay; board: Chessboard | null }) {
  const date = day.date;
  const s = board?.summary[date];
  const total = s ? s.occupied + s.free + s.blocked : 0;
  const count = (status: 'DIRTY' | 'CLEAN' | 'INSPECTED') =>
    board?.rows.filter((r) => r.unit.housekeepingStatus === status).length ?? 0;
  const repairs =
    board?.rows.filter((r) => {
      const cell = r.cells.find((c) => c.date === date);
      return !!cell?.blockType && REPAIR.includes(cell.blockType);
    }).length ?? 0;
  const calendar = `/chessboard?from=${date}&to=${date}`;
  const bookings = `/reservations?date=${date}`;
  const c = day.counts;
  return (
    <div className="tw-grid">
      <article className="tw-card" aria-label="Загрузка на сегодня">
        <header>
          <h3>Загрузка на сегодня</h3>
          <Link href={`/management/analytics/occupancy?date=${date}`}>Подробно</Link>
        </header>
        {s ? (
          <div className="tw-load">
            <Ring occupied={s.occupied} blocked={s.blocked} total={total} />
            <ul>
              <Row label="Занято" value={s.occupied} of={total} tone="ok" href={calendar} id="tw-occupied" />
              <Row
                label="Свободно"
                value={s.free}
                of={total}
                tone="warn"
                href={`/rooms/availability?arrival=${date}`}
                id="c-free"
              />
              {s.blocked > 0 && (
                <Row label="Заблокировано" value={s.blocked} of={total} tone="muted" href={calendar} />
              )}
              <Row label="Всего мест" value={total} of={total} tone="info" id="tw-total" />
            </ul>
          </div>
        ) : (
          <p className="tw-empty">Календарь дня не загрузился. Обновите страницу.</p>
        )}
      </article>

      <article className="tw-card" aria-label="Гости сегодня" data-testid="owner-movements">
        <header>
          <h3>Гости сегодня</h3>
          <Link href={bookings}>Брони дня</Link>
        </header>
        <ul>
          <Row
            label="Заезды"
            value={c.arrivals}
            note={c.toCheckIn ? `ждут ${c.toCheckIn}` : undefined}
            of={total || c.arrivals}
            tone="ok"
            href={bookings}
            id="tw-arrivals"
          />
          <Row
            label="Выезды"
            value={c.departures}
            note={c.toCheckOut ? `ждут ${c.toCheckOut}` : undefined}
            of={total || c.departures}
            tone="warn"
            href={bookings}
            id="tw-departures"
          />
          <Row
            label="Проживают"
            value={c.inHouse}
            of={total || c.inHouse}
            tone="info"
            href={`/guests?state=inhouse`}
            id="owner-guests"
          />
          <Row
            label="Не заехали"
            value={c.overdueArrivals}
            of={total || c.overdueArrivals}
            tone="bad"
            href={bookings}
            id="tw-overdue"
          />
        </ul>
      </article>

      <article className="tw-card" aria-label="Состояние номеров">
        <header>
          <h3>Состояние номеров</h3>
          <Link href="/inventory">Номерной фонд</Link>
        </header>
        {board ? (
          <ul>
            <Row label="Грязно" value={count('DIRTY')} of={total} tone="bad" id="tw-dirty" />
            <Row label="Убрано" value={count('CLEAN')} of={total} tone="warn" id="tw-clean" />
            <Row label="Проверено" value={count('INSPECTED')} of={total} tone="ok" id="tw-inspected" />
            <Row label="Ремонт" value={repairs} of={total} tone="muted" id="tw-repair" />
          </ul>
        ) : (
          <p className="tw-empty">Календарь дня не загрузился. Обновите страницу.</p>
        )}
      </article>
    </div>
  );
}
