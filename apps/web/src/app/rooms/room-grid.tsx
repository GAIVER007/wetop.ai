'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { Chessboard, InventoryUnit } from '../../lib/api';
import { Icon } from '../../components/icon';
import { Input, StatusBadge } from '../../components/ui';
export function RoomGrid({ units, board }: { units: InventoryUnit[]; board: Chessboard | null }) {
  const [kind, setKind] = useState('ROOM'),
    [status, setStatus] = useState('ALL'),
    [q, setQ] = useState(''),
    [view, setView] = useState('grid');
  const states = new Map(board?.rows.map((row) => [row.unit.code, row.cells[0]]));
  const rows = units.filter(
    (u) =>
      (!kind || u.kind === kind) &&
      `${u.code} ${u.accommodationTypeName}`
        .toLocaleLowerCase('ru')
        .includes(q.trim().toLocaleLowerCase('ru')) &&
      (status === 'ALL' || states.get(u.code)?.state === status),
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
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Доступность номеров"
        >
          <option value="ALL">Все статусы</option>
          <option value="FREE">Свободные</option>
          <option value="OCCUPIED">Занятые</option>
          <option value="BLOCKED">Недоступные</option>
        </select>
      </div>
      <div className={`room-cards ${view === 'list' ? 'room-cards--list' : ''}`}>
        {rows.map((u) => {
          const cell = states.get(u.code);
          const state = cell?.state;
          return (
            <Link key={u.code} href={`/units/${encodeURIComponent(u.code)}`} className="room-card">
              <div className="room-card-top">
                <span className="round-icon">
                  <Icon name={u.kind === 'ROOM' ? 'inventory' : 'bed'} />
                </span>
                <StatusBadge
                  status={
                    state === 'OCCUPIED'
                      ? 'CHECKED_IN'
                      : state === 'BLOCKED'
                        ? 'TENTATIVE'
                        : 'CHECKED_OUT'
                  }
                  label={
                    state === 'OCCUPIED'
                      ? 'Занят'
                      : state === 'BLOCKED'
                        ? cell?.blockType === 'CLEANING'
                          ? 'Уборка'
                          : cell?.blockType === 'MAINTENANCE'
                            ? 'Ремонт'
                            : 'Заблокирован'
                        : state === 'FREE'
                          ? 'Свободен'
                          : 'Нет данных'
                  }
                />
              </div>
              <div className="room-card-name">
                <strong>{u.code}</strong>
                <span>{u.kind === 'ROOM' ? 'Отдельный номер' : 'Койко-место'}</span>
              </div>
              <p>{u.accommodationTypeName}</p>
              <div className="room-card-footer">
                <span>
                  <Icon name="guests" width={14} />
                  {u.roomCapacity} мест в комнате
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
