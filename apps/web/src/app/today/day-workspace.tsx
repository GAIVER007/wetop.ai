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
export function DayWorkspace({ day }: { day: DeskDay }) {
  const [view, setView] = useState('all');
  const [query, setQuery] = useState('');
  const filter = (rows: DeskRow[]) =>
    rows.filter((r) =>
      [r.guestLabel, r.confirmationNumber, r.unitCode, r.accommodationTypeName].some((v) =>
        v?.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')),
      ),
    );
  const tabs = [
    ['all', 'Весь день', null],
    ['arrivals', 'Заезды', day.arrivals.length],
    ['departures', 'Выезды', day.departures.length],
    ['inhouse', 'Живут', day.inHouse.length],
  ] as const;
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
          {tabs.map(([id, title, count]) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              className={cx('day-tab', view === id && 'is-active')}
              onClick={() => setView(id)}
            >
              {title}
              {count !== null && <span>{count}</span>}
            </button>
          ))}
        </div>
      </div>
      {(view === 'all' || view === 'arrivals') && (
        <Group title="Заезжают" rows={filter(day.arrivals)} testId="arrivals" showBlocked />
      )}
      {(view === 'all' || view === 'departures') && (
        <Group title="Выезжают" rows={filter(day.departures)} testId="departures" showDebt />
      )}
      {(view === 'all' || view === 'inhouse') && (
        <Group title="Живут" rows={filter(day.inHouse)} testId="inhouse" />
      )}
      <div className="day-table-footer">
        <Icon name="check" /> Выберите гостя, чтобы открыть бронирование
      </div>
    </section>
  );
}

function Group({
  title,
  rows,
  testId,
  showBlocked,
  showDebt,
}: {
  title: string;
  rows: DeskRow[];
  testId: string;
  showBlocked?: boolean;
  showDebt?: boolean;
}) {
  return (
    <section className="day-group">
      <h3 className="day-group-title">
        <span className={`day-group-dot day-group-dot--${testId}`} />
        {title}
        <span>{rows.length}</span>
      </h3>
      <Table data-testid={`group-${testId}`} className="day-table">
        <thead>
          <tr>
            <th>Гость</th>
            <th>Размещение</th>
            <th>Проживание</th>
            <th>{showDebt ? 'Статус / счёт' : 'Статус'}</th>
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
            return (
              <tr key={r.itemId} data-testid={`row-${testId}`}>
                <td>
                  <div className="day-guest">
                    <span
                      className={`day-guest-avatar day-guest-avatar--${testId}`}
                      aria-hidden="true"
                    >
                      {r.guestLabel
                        .split(' ')
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((n) => n[0])
                        .join('') || '—'}
                    </span>
                    <div>
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
                    </div>
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
                <td className="nowrap">
                  <time dateTime={r.arrivalDate}>{displayDate(r.arrivalDate)}</time>
                  <span className="day-stay-arrow"> → </span>
                  <br />
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
                    <div
                      className={cx(
                        'cell-sub',
                        BigInt(r.balanceMinor) > 0n ? 'danger-text bold' : 'muted',
                      )}
                    >
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
    </section>
  );
}
