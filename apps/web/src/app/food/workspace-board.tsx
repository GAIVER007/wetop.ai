'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Notice,
  Panel,
  Select,
  Table,
} from '../../components/ui';
import { occupiedAt } from '../../lib/food-data';
import type { FoodWorkspace, RestaurantReservation } from '../../lib/food-types';
import { instantOf, localInput } from '../beauty/time';
import { ReservationDrawer, type ReservationDraft } from './reservation-drawer';
import { DayToolbar } from './day-toolbar';
import { foodStatus } from '../../lib/status/food';
export function WorkspaceBoard({ data, floor }: { data: FoodWorkspace; floor: boolean }) {
  const [draft, setDraft] = useState<ReservationDraft | null>(null);
  const [period, setPeriod] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [area, setArea] = useState('');
  const [table, setTable] = useState('');
  const [switching, setSwitching] = useState(false);
  useEffect(() => {
    const begin = () => {
      setDraft(null);
      setSwitching(true);
    };
    const failed = () => setSwitching(false);
    window.addEventListener('wetop-scope-switch', begin);
    window.addEventListener('wetop-scope-switch-failed', failed);
    return () => {
      window.removeEventListener('wetop-scope-switch', begin);
      window.removeEventListener('wetop-scope-switch-failed', failed);
    };
  }, []);
  useEffect(() => setSwitching(false), [data.scopeKey]);
  if (switching) return <p role="status">Переключаем ресторан…</p>;
  const write = data.canDesk && !data.readOnly;
  const at = instantOf(`${data.date}T${data.time}`, data.timezone);
  // Table occupancy always considers every period, even when a period filter hides list entries.
  const occupying = data.reservations.filter((r) => occupiedAt(r, at));
  const activeTables = data.tables.filter(
    (t) => t.active && data.areas.some((a) => a.id === t.areaId && a.active),
  );
  const unassigned = data.reservations.filter(
    (r) =>
      !r.table &&
      ['BOOKED', 'CONFIRMED', 'SEATED'].includes(r.status) &&
      localInput(r.startsAt, data.timezone).slice(0, 10) === data.date &&
      (!period || r.servicePeriodId === period),
  );
  const filtered = data.reservations
    .filter(
      (r) =>
        (!period || r.servicePeriodId === period) &&
        (!status || r.status === status) &&
        (!area || r.table?.areaId === area) &&
        (!table || r.table?.id === table) &&
        `${r.customer.firstName} ${r.customer.lastName ?? ''} ${r.customer.phone ?? ''}`
          .toLocaleLowerCase('ru')
          .includes(search.toLocaleLowerCase('ru')),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const customer = (r: RestaurantReservation) =>
    [r.customer.firstName, r.customer.lastName].filter(Boolean).join(' ');
  const clock = (iso: string) => localInput(iso, data.timezone).slice(11);
  const open = (r: RestaurantReservation) => setDraft({ kind: 'view', id: r.id });
  return (
    <div className="food-workspace">
      <div className="food-section-heading">
        <DayToolbar data={data} floor={floor} period={period} setPeriod={setPeriod} />
        {write && (
          <div className="food-inline-actions">
            <Button onClick={() => setDraft({ kind: 'create', walkIn: false })}>
              + Новая бронь
            </Button>
            {floor && (
              <Button tone="secondary" onClick={() => setDraft({ kind: 'create', walkIn: true })}>
                Посадить без брони
              </Button>
            )}
          </div>
        )}
      </div>
      {!data.periods.some((p) => p.active) && <Notice>Настройте период обслуживания</Notice>}
      {floor ? (
        <>
          <div className="food-summary" aria-label="Состояние столов">
            <span>
              Столов <strong>{activeTables.length}</strong>
            </span>
            <span>
              Свободно{' '}
              <strong>
                {activeTables.filter((t) => !occupying.some((r) => r.table?.id === t.id)).length}
              </strong>
            </span>
            <span>
              Бронь{' '}
              <strong>{occupying.filter((r) => r.table && r.status !== 'SEATED').length}</strong>
            </span>
            <span>
              Посажено{' '}
              <strong>{occupying.filter((r) => r.table && r.status === 'SEATED').length}</strong>
            </span>
            <span>
              Без стола <strong>{unassigned.length}</strong>
            </span>
          </div>
          {data.areas.filter((a) => a.active).length === 0 ? (
            <EmptyState
              title="Сначала добавьте зал и столы"
              actions={
                data.canProperty && !data.readOnly ? (
                  <Link className="btn" href="/dining-areas">
                    Добавить зал
                  </Link>
                ) : null
              }
            />
          ) : (
            data.areas
              .filter((a) => a.active)
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((a) => (
                <section key={a.id} aria-label={a.name}>
                  <h2>{a.name}</h2>
                  {activeTables.filter((t) => t.areaId === a.id).length === 0 ? (
                    <p className="muted">В этом зале пока нет столов</p>
                  ) : (
                    <div className="food-table-grid">
                      {activeTables
                        .filter((t) => t.areaId === a.id)
                        .sort((x, y) => x.sortOrder - y.sortOrder)
                        .map((t) => {
                          const r = occupying.find((r) => r.table?.id === t.id);
                          return (
                            <button
                              type="button"
                              key={t.id}
                              className="food-table-card"
                              data-status={r?.status ?? 'FREE'}
                              aria-label={`${t.name}, ${r ? foodStatus[r.status].label : 'Свободен'}`}
                              onClick={() =>
                                r
                                  ? open(r)
                                  : write &&
                                    setDraft({ kind: 'create', walkIn: false, tableId: t.id })
                              }
                            >
                              <strong>{t.name}</strong>
                              <small>{t.capacity} места</small>
                              {r ? (
                                <>
                                  <span>
                                    {r.status === 'SEATED' ? 'За столом' : clock(r.startsAt)}
                                  </span>
                                  <span>
                                    {customer(r)}, {r.partySize} гостя
                                  </span>
                                  <small>до {clock(r.endsAt)}</small>
                                </>
                              ) : (
                                <span>Свободен</span>
                              )}
                              <Badge tone={r?.status === 'SEATED' ? 'ok' : r ? 'info' : 'neutral'}>
                                {r ? foodStatus[r.status].label : 'Свободен'}
                              </Badge>
                            </button>
                          );
                        })}
                    </div>
                  )}
                </section>
              ))
          )}
          <Panel>
            <h2>Без стола, {unassigned.length}</h2>
            <div className="food-unassigned">
              {unassigned.map((r) => (
                <button className="food-reservation-card" key={r.id} onClick={() => open(r)}>
                  {clock(r.startsAt)}, {customer(r)}, {r.partySize} гостя
                </button>
              ))}
              {!unassigned.length && <p className="muted">Все бронирования назначены</p>}
            </div>
          </Panel>
        </>
      ) : (
        <>
          <div className="food-toolbar">
            <Field label="Поиск клиента">
              <Input
                type="search"
                data-page-search
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>
            <Field label="Статус">
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Все</option>
                {Object.entries(foodStatus).map(([s, { label: l }]) => (
                  <option key={s} value={s}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Зал">
              <Select
                value={area}
                onChange={(e) => {
                  setArea(e.target.value);
                  setTable('');
                }}
              >
                <option value="">Все</option>
                {data.areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Стол">
              <Select value={table} onChange={(e) => setTable(e.target.value)}>
                <option value="">Все</option>
                {data.tables
                  .filter((t) => !area || t.areaId === area)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </Select>
            </Field>
          </div>
          {!filtered.length ? (
            <EmptyState
              title={
                data.reservations.length
                  ? 'Бронирования не найдены'
                  : 'На этот день бронирований нет'
              }
            />
          ) : (
            <>
              <div className="food-desktop-reservations">
                <Table>
                  <thead>
                    <tr>
                      {['Время', 'Клиент', 'Гостей', 'Период', 'Стол', 'Статус', 'Источник'].map(
                        (h) => (
                          <th key={h}>{h}</th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.id} onClick={() => open(r)}>
                        <td>
                          {clock(r.startsAt)}–{clock(r.endsAt)}
                        </td>
                        <td>
                          <Button tone="ghost" onClick={() => open(r)}>
                            {customer(r)}
                          </Button>
                        </td>
                        <td>{r.partySize}</td>
                        <td>{r.servicePeriod.name}</td>
                        <td>{r.table ? `${r.table.areaName}, ${r.table.name}` : 'Без стола'}</td>
                        <td>
                          <Badge>{foodStatus[r.status].label}</Badge>
                        </td>
                        <td>{r.source === 'WALK_IN' ? 'Без брони' : 'Сотрудник'}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              <div className="food-mobile-reservations">
                {filtered.map((r) => (
                  <button className="food-reservation-card" key={r.id} onClick={() => open(r)}>
                    <div className="food-section-heading">
                      <strong>
                        {clock(r.startsAt)}–{clock(r.endsAt)}
                      </strong>
                      <Badge>{foodStatus[r.status].label}</Badge>
                    </div>
                    <strong>{customer(r)}</strong>
                    <span>{r.partySize} гостя</span>
                    <span>{r.table ? `${r.table.areaName}, ${r.table.name}` : 'Без стола'}</span>
                    <small>{r.servicePeriod.name}</small>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
      {draft && (
        <ReservationDrawer
          data={data}
          draft={draft}
          close={() => setDraft(null)}
          onCreated={(id) => setDraft({ kind: 'view', id })}
        />
      )}
    </div>
  );
}
