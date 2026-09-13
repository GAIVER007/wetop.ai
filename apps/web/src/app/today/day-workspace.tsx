'use client';
import Link from 'next/link';
import { useState } from 'react';
import { formatMinor, messengerLinks, type DeskDay, type DeskRow } from '../../lib/api';
import { Input, SectionTitle, StatusBadge, Table, cx } from '../../components/ui';
import { Icon } from '../../components/icon';

const STATUS_RU: Record<string, string> = {
  TENTATIVE: 'предварительная',
  CONFIRMED: 'ждём',
  CHECKED_IN: 'живёт',
  CHECKED_OUT: 'выселен',
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
    ['all', 'Весь день', day.arrivals.length + day.departures.length + day.inHouse.length],
    ['arrivals', 'Заезды', day.arrivals.length],
    ['departures', 'Выезды', day.departures.length],
    ['inhouse', 'Живут', day.inHouse.length],
  ] as const;
  return (
    <section className="day-workspace">
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
              {id !== 'all' && <span>{count}</span>}
            </button>
          ))}
        </div>
        <label className="day-search">
          <Icon name="search" />
          <Input
            aria-label="Поиск в рабочем дне"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Гость, бронь или ячейка"
          />
        </label>
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
  const head = ['Гость', 'Ячейка', 'Категория', 'Проживание', 'Статус'];
  if (showDebt) head.push('Счёт');
  return (
    <>
      <SectionTitle>
        {title} — {rows.length}
      </SectionTitle>
      <Table data-testid={`group-${testId}`}>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} className={h === 'Счёт' ? 'num' : undefined}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={head.length} className="muted">
                никого
              </td>
            </tr>
          )}
          {rows.map((r) => {
            const m = messengerLinks(r.guestPhone);
            return (
              <tr key={r.itemId} data-testid={`row-${testId}`}>
                {/*
                 * Имя — ссылка на бронь: администратор ищет глазами гостя, а не номер. Сам номер
                 * второй строкой мелким моноширинным: он нужен, когда его диктуют по телефону.
                 */}
                <td>
                  <Link
                    href={`/reservations/${encodeURIComponent(r.confirmationNumber)}`}
                    className="bold"
                  >
                    {r.guestLabel || 'без имени'}
                  </Link>
                  {m && (
                    <>
                      {' '}
                      <a href={m.whatsapp} target="_blank" rel="noreferrer" className="small">
                        WA
                      </a>
                    </>
                  )}
                  <div className="cell-sub mono">{r.confirmationNumber}</div>
                </td>
                <td>
                  {r.unitCode ? (
                    <Link href={`/units/${encodeURIComponent(r.unitCode)}`} className="unit">
                      {r.unitCode}
                    </Link>
                  ) : (
                    <span className="warn-text">нет</span>
                  )}
                </td>
                <td>{r.accommodationTypeName}</td>
                <td className="nowrap">
                  {r.arrivalDate} → {r.departureDate}
                </td>
                <td>
                  <StatusBadge status={r.status} label={STATUS_RU[r.status] ?? r.status} />
                  {showBlocked && r.blockedReason && (
                    <div className="cell-sub warn-text">{r.blockedReason}</div>
                  )}
                  {showBlocked && r.guestsRecorded < r.adults && !r.blockedReason && (
                    <div className="cell-sub warn-text">
                      карточек {r.guestsRecorded} из {r.adults}
                    </div>
                  )}
                </td>
                {showDebt && (
                  <td className="num">
                    <span className={BigInt(r.balanceMinor) > 0n ? 'danger-text bold' : 'muted'}>
                      {formatMinor(r.balanceMinor)}
                    </span>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </Table>
    </>
  );
}
