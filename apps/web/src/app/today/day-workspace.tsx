'use client';
import Link from 'next/link';
import { useState } from 'react';
import { formatMinor, messengerLinks, type DeskDay, type DeskRow } from '../../lib/api';
import { displayDate } from '../../lib/display-date';
import { Input, StatusBadge, Table, cx } from '../../components/ui';
import { Icon } from '../../components/icon';

const STATUS_RU: Record<string, string> = {
  TENTATIVE: 'Предварительная',
  CONFIRMED: 'Ожидает заезда',
  CHECKED_IN: 'Проживает',
  CHECKED_OUT: 'Выехал',
};

type View = 'arrivals' | 'departures' | 'inhouse';

/**
 * Списки дня: один список на экране, остальные — за вкладкой со счётчиком.
 *
 * Прежний вид «Весь день» раскладывал три таблицы подряд — 34 + 32 + 62 строки с аватарами,
 * и главная уходила в бесконечную прокрутку (замечание владельца 15.09.2026). Теперь список
 * ограничен по высоте и прокручивается сам, строки в одну линию, сверху — те, кем ещё надо заняться:
 * не заселённые в заездах, не выехавшие в выездах.
 */
export function DayWorkspace({ day }: { day: DeskDay }) {
  const [view, setView] = useState<View>('arrivals');
  const [query, setQuery] = useState('');
  const q = query.trim().toLocaleLowerCase('ru');
  const filter = (rows: DeskRow[]) =>
    q
      ? rows.filter((r) =>
          [r.guestLabel, r.confirmationNumber, r.unitCode, r.accommodationTypeName].some((v) =>
            v?.toLocaleLowerCase('ru').includes(q),
          ),
        )
      : rows;
  const lists: Record<View, { title: string; rows: DeskRow[]; pendingFirst: (r: DeskRow) => boolean }> = {
    arrivals: { title: 'Заезды', rows: day.arrivals, pendingFirst: (r) => r.status !== 'CHECKED_IN' },
    departures: {
      title: 'Выезды',
      rows: day.departures,
      pendingFirst: (r) => r.status !== 'CHECKED_OUT',
    },
    inhouse: { title: 'Живут', rows: day.inHouse, pendingFirst: () => false },
  };
  const current = lists[view];
  const rows = pendingOnTop(filter(current.rows), current.pendingFirst);
  return (
    <section className="day-workspace">
      <div className="day-section-head">
        <h2>Работа с гостями</h2>
        <label className="day-search">
          <Icon name="search" />
          <Input
            aria-label="Поиск в рабочем дне"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Гость, бронь или место"
          />
        </label>
      </div>
      <div className="day-toolbar">
        <div className="day-tabs" aria-label="Списки рабочего дня">
          {(Object.keys(lists) as View[]).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              className={cx('day-tab', view === id && 'is-active')}
              onClick={() => setView(id)}
            >
              {lists[id].title}
              <span>{lists[id].rows.length}</span>
            </button>
          ))}
        </div>
      </div>
      <Group
        rows={rows}
        testId={view}
        showBlocked={view === 'arrivals'}
        showDebt={view === 'departures'}
      />
      <div className="day-table-footer">
        <span>
          {q && rows.length !== current.rows.length
            ? `Найдено ${rows.length} из ${current.rows.length}`
            : `${current.rows.length} ${plural(current.rows.length)}`}
        </span>
        <Link href={`/reservations?date=${day.date}`}>
          Все брони дня <Icon name="arrow" width={12} />
        </Link>
      </div>
    </section>
  );
}

/** Сначала те, кем ещё надо заняться; внутри групп порядок API не меняется */
function pendingOnTop(rows: DeskRow[], pending: (r: DeskRow) => boolean): DeskRow[] {
  return [...rows.filter(pending), ...rows.filter((r) => !pending(r))];
}

function plural(n: number): string {
  const d = n % 10;
  const h = n % 100;
  if (h >= 11 && h <= 14) return 'размещений';
  if (d === 1) return 'размещение';
  if (d >= 2 && d <= 4) return 'размещения';
  return 'размещений';
}

function Group({
  rows,
  testId,
  showBlocked,
  showDebt,
}: {
  rows: DeskRow[];
  testId: View;
  showBlocked?: boolean;
  showDebt?: boolean;
}) {
  return (
    <div className="day-list" data-testid={`group-${testId}`}>
      <Table className="day-table" nowrap>
        <thead>
          <tr>
            <th>Гость</th>
            <th>Место</th>
            <th>Проживание</th>
            <th>{showDebt ? 'Статус и счёт' : 'Статус'}</th>
            <th>
              <span className="sr-only">Действие</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="day-empty">
                В этом списке пока никого нет
              </td>
            </tr>
          )}
          {rows.map((r) => {
            const m = messengerLinks(r.guestPhone);
            const url = `/reservations/${encodeURIComponent(r.confirmationNumber)}`;
            const debt = showDebt && BigInt(r.balanceMinor) > 0n;
            return (
              <tr key={r.itemId} data-testid={`row-${testId}`}>
                <td>
                  <Link href={url} className="day-guest-name">
                    {r.guestLabel || 'Гость без имени'}
                  </Link>
                  <div className="cell-sub">
                    <span className="booking-number">{r.confirmationNumber}</span>
                    {m && (
                      <>
                        {' '}
                        ·{' '}
                        <a
                          href={m.whatsapp}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`WhatsApp: ${r.guestLabel}`}
                        >
                          WA
                        </a>
                      </>
                    )}
                  </div>
                </td>
                <td>
                  {r.unitCode ? (
                    <Link href={`/units/${encodeURIComponent(r.unitCode)}`} className="day-unit">
                      <Icon name="bed" />
                      {r.unitCode}
                    </Link>
                  ) : (
                    <span className="warn-text">Не назначено</span>
                  )}
                  <div className="cell-sub day-category">{r.accommodationTypeName}</div>
                </td>
                <td>
                  <time dateTime={r.arrivalDate}>{displayDate(r.arrivalDate)}</time>
                  {/* стрелка периода «заезд → выезд» (DESIGN.md §14) */}
                  <span className="day-stay-arrow" aria-label="по">
                    {' → '}
                  </span>
                  <time dateTime={r.departureDate}>{displayDate(r.departureDate)}</time>
                </td>
                <td>
                  <StatusBadge status={r.status} label={STATUS_RU[r.status] ?? r.status} />
                  {showBlocked && r.blockedReason && (
                    <div className="cell-sub warn-text">{r.blockedReason}</div>
                  )}
                  {showBlocked && r.guestsRecorded < r.adults && !r.blockedReason && (
                    <div className="cell-sub warn-text">
                      Карточки: {r.guestsRecorded} из {r.adults}
                    </div>
                  )}
                  {showDebt && (
                    <div className={cx('cell-sub', debt ? 'danger-text bold' : 'muted')}>
                      {formatMinor(r.balanceMinor)}
                    </div>
                  )}
                </td>
                <td className="day-row-action">
                  <Link
                    href={`${url}#${showDebt ? 'booking-finance' : 'booking-actions'}`}
                    className="icon-button"
                    aria-label={`Открыть бронь ${r.confirmationNumber}`}
                  >
                    <Icon name="arrow" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
