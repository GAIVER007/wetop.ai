'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { Chessboard, ChessboardCell, InventoryUnit } from '../../lib/api';
import { Icon } from '../../components/icon';
import { Input, StatusBadge } from '../../components/ui';
import { displayDate } from '../../lib/display-date';

/**
 * Карточки номеров и коек. Доска на неделю от сегодня даёт каждой карточке главное для стойки:
 * занят — кем и до какого числа, свободен — до какого числа (или «7+ ночей»), закрыт — почему.
 */
export function RoomGrid({ units, board }: { units: InventoryUnit[]; board: Chessboard | null }) {
  const [kind, setKind] = useState('ROOM'),
    [status, setStatus] = useState('ALL'),
    [category, setCategory] = useState(''),
    [q, setQ] = useState(''),
    [view, setView] = useState('grid');
  const cells = new Map(board?.rows.map((row) => [row.unit.code, row.cells]));
  const categories = [
    ...new Map(units.map((u) => [u.accommodationTypeCode, u.accommodationTypeName])),
  ];
  const rows = units.filter(
    (u) =>
      (!kind || u.kind === kind) &&
      (!category || u.accommodationTypeCode === category) &&
      `${u.code} ${u.accommodationTypeName}`
        .toLocaleLowerCase('ru')
        .includes(q.trim().toLocaleLowerCase('ru')) &&
      (status === 'ALL' || cells.get(u.code)?.[0]?.state === status),
  );
  return (
    <section className="room-directory">
      <div className="room-directory-head">
        <h2 className="section-title">Номера и койко-места</h2>
        <span className="seg">
          {[
            ['grid', 'Карточки'],
            ['list', 'Список'],
          ].map(([id, label]) => (
            <button
              className={`segment-button ${view === id ? 'is-on' : ''}`}
              key={id}
              onClick={() => setView(id!)}
              aria-pressed={view === id}
            >
              {label}
            </button>
          ))}
        </span>
      </div>
      <div className="directory-toolbar">
        <div className="search-field">
          <Icon name="search" />
          <Input
            aria-label="Поиск номеров"
            placeholder="Номер или категория"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          className="inp"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          aria-label="Тип единиц"
        >
          <option value="">Все единицы</option>
          <option value="ROOM">Номера</option>
          <option value="BED">Койко-места</option>
        </select>
        <select
          className="inp"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Категория"
        >
          <option value="">Все категории</option>
          {categories.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
        <select
          className="inp"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Доступность номеров"
        >
          <option value="ALL">Все статусы</option>
          <option value="FREE">Свободные</option>
          <option value="OCCUPIED">Занятые</option>
          <option value="BLOCKED">Недоступные</option>
        </select>
        <span className="muted small">
          {rows.length} из {units.length}
        </span>
      </div>
      <div className={`room-cards ${view === 'list' ? 'room-cards--list' : ''}`}>
        {rows.map((u) => {
          const c = cells.get(u.code);
          const cell = c?.[0];
          const state = cell?.state;
          return (
            <Link
              key={u.code}
              href={`/units/${encodeURIComponent(u.code)}`}
              className="room-card"
              data-state={state ?? 'UNKNOWN'}
            >
              <div className="room-card-top">
                <strong className="room-card-code">
                  <Icon name={u.kind === 'ROOM' ? 'inventory' : 'bed'} />
                  {u.code}
                </strong>
                <StatusBadge status={badgeStatus(state)} label={badgeLabel(cell, board !== null)} />
              </div>
              <p className="room-card-cat">{u.accommodationTypeName}</p>
              <div className="room-card-note">
                {c ? note(c) : board ? 'нет данных на сегодня' : 'занятость не загрузилась'}
              </div>
              <div className="room-card-footer">
                <span>
                  {u.kind === 'ROOM' ? 'Отдельный номер' : 'Койко-место'} · {u.roomCapacity}{' '}
                  {u.roomCapacity === 1 ? 'место' : u.roomCapacity < 5 ? 'места' : 'мест'} в комнате
                </span>
                <Icon name="arrow" width={16} />
              </div>
            </Link>
          );
        })}
      </div>
      {!rows.length && (
        <div className="empty-state">
          <Icon name="bed" />
          <h3>Нет подходящих номеров</h3>
          <p>Измените поиск или выберите другой статус.</p>
          <button
            className="btn btn--secondary"
            onClick={() => {
              setKind('');
              setCategory('');
              setStatus('ALL');
              setQ('');
            }}
          >
            Сбросить фильтры
          </button>
        </div>
      )}
    </section>
  );
}

function badgeStatus(state: string | undefined): string {
  return state === 'OCCUPIED' ? 'CHECKED_IN' : state === 'BLOCKED' ? 'TENTATIVE' : 'CHECKED_OUT';
}
function badgeLabel(cell: ChessboardCell | undefined, boardLoaded = true): string {
  // Пустая клетка значит разное: шахматка не ответила или единицы нет на доске (§7.3)
  if (!cell) return boardLoaded ? 'Нет данных' : 'Занятость не загрузилась';
  if (cell.state === 'OCCUPIED') return 'Занят';
  if (cell.state === 'FREE') return 'Свободен';
  return cell.blockType === 'CLEANING'
    ? 'Уборка'
    : cell.blockType === 'MAINTENANCE'
      ? 'Ремонт'
      : 'Заблокирован';
}

/** Главное о единице на сегодня по неделе доски: до какого числа занят или свободен. */
function note(cells: ChessboardCell[]): string {
  const first = cells[0]!;
  if (first.state === 'OCCUPIED') {
    let last = 0;
    while (
      last + 1 < cells.length &&
      cells[last + 1]!.state === 'OCCUPIED' &&
      cells[last + 1]!.itemId === first.itemId
    )
      last++;
    const who = first.guestLabel || first.confirmationNumber || 'гость';
    const ends = last < cells.length - 1 || cells[last]!.isLastNight;
    return ends
      ? `${who} · выезд ${displayDate(nextDay(cells[last]!.date))}`
      : `${who} · после ${displayDate(cells[last]!.date)}`;
  }
  if (first.state === 'BLOCKED') {
    const kind =
      first.blockType === 'CLEANING'
        ? 'уборка'
        : first.blockType === 'MAINTENANCE'
          ? 'ремонт'
          : 'закрыт';
    return first.blockReason ? `${kind}: ${first.blockReason}` : kind;
  }
  const busy = cells.findIndex((c, i) => i > 0 && c.state !== 'FREE');
  return busy === -1
    ? `свободен ${cells.length}+ ночей`
    : `свободен до ${displayDate(cells[busy]!.date)}`;
}

const nextDay = (d: string) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + 1);
  return x.toISOString().slice(0, 10);
};
