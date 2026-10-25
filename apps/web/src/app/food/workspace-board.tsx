'use client';
import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Button, EmptyState, Help, Notice, StatusBadge, Table } from '../../components/ui';
import { Icon } from '../../components/icon';
import { Segmented } from '../../components/segmented';
import { Tabs } from '../../components/tabs';
import { pluralRu } from '../../lib/plural';
import { occupiedAt } from '../../lib/food-data';
import type { DiningTable, FoodWorkspace, RestaurantReservation } from '../../lib/food-types';
import { instantOf, localInput } from '../beauty/time';
import { ReservationDrawer, type ReservationDraft } from './reservation-drawer';
import { DayToolbar } from './day-toolbar';
import { foodStatus } from '../../lib/status/food';
import { setTableCleaning } from './restaurant-actions';
import { GuestMarks } from './guest-marks';
import { TimelineBoard } from './timeline-board';
import { TablePanel, KIND_LABEL, type TableKind } from './table-panel';
import { FloorLayoutEditor, SHAPE_CSS, spotStyle } from './floor-layout-editor';
import { layoutSpots, tableShapeOf } from '@pms/domain';
import { QuickReport } from '../../components/quick-report';
import { JournalExpandButton } from '../../components/journal-expand';
import { DayNav } from '../../components/day-nav';
import { JournalFilter, JournalHead, JournalSearch, FiltersTitle } from '../../components/journal-head';
import { useNarrow } from '../../lib/use-narrow';
import { SummaryLine } from '../../lib/summary-line';
import { foodQuickReport } from '../../components/quick-report-data';
import { compareTables } from '../../lib/table-title';
import { formatPhone } from '../../lib/phone';
import { foodReservationOrigin } from '../../lib/food-reservation-origin';

const ACTIVE = ['BOOKED', 'CONFIRMED', 'SEATED'];

/**
 * План зала и расписание броней по макету (экраны 2 и 3). Сверху одна строка: вкладки «План зала /
 * Расписание», день, период, отборы и «+ Новая бронь». План: зоны столбиком слева, полотно со столами,
 * залитыми цветом статуса на время плана, легенда со счётчиками, карточка выбранного стола справа.
 */
export function WorkspaceBoard({
  data,
  floor,
  startNew = false,
  listView = false,
}: {
  data: FoodWorkspace;
  floor: boolean;
  startNew?: boolean;
  /** `?view=list`: таблица броней вместо шкалы по столам */
  listView?: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<ReservationDraft | null>(
    startNew && data.canDesk && !data.readOnly ? { kind: 'create', walkIn: false } : null,
  );
  const [period, setPeriod] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [area, setArea] = useState('');
  const [view, setView] = useState<'timeline' | 'list'>(listView ? 'list' : 'timeline');
  const narrow = useNarrow();
  const [panelTable, setPanelTable] = useState<string | null>(null);
  const [cleaningPending, startCleaning] = useTransition();
  const [cleaningError, setCleaningError] = useState<string | null>(null);
  // все хуки до раннего возврата «Переключаем ресторан…», иначе React падает на смене филиала (ADR-181, аудит P1.5)
  const [editingArea, setEditingArea] = useState<string | null>(null);
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
  // занятость стола считается по всем периодам, даже когда отбор периода скрывает брони списка
  const occupying = data.reservations.filter((r) => occupiedAt(r, at));
  const areas = data.areas.filter((a) => a.active).sort((a, b) => a.sortOrder - b.sortOrder);
  const activeTables = data.tables
    .filter((t) => t.active && areas.some((a) => a.id === t.areaId))
    .sort(compareTables);
  const onDay = (r: RestaurantReservation) =>
    localInput(r.startsAt, data.timezone).slice(0, 10) === data.date;
  const unassigned = data.reservations.filter(
    (r) =>
      !r.table &&
      ACTIVE.includes(r.status) &&
      onDay(r) &&
      (!period || r.servicePeriodId === period),
  );
  const filtered = data.reservations
    .filter(
      (r) =>
        (!period || r.servicePeriodId === period) &&
        (!status || r.status === status) &&
        (!area || r.table?.areaId === area) &&
        `${r.customer.firstName} ${r.customer.lastName ?? ''} ${r.customer.phone ?? ''}`
          .toLocaleLowerCase('ru')
          .includes(search.toLocaleLowerCase('ru')),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const customer = (r: RestaurantReservation) =>
    [r.customer.firstName, r.customer.lastName].filter(Boolean).join(' ');
  const guests = (n: number) => pluralRu(n, ['гость', 'гостя', 'гостей']);
  const clock = (iso: string) => localInput(iso, data.timezone).slice(11);
  const open = (r: RestaurantReservation) => setDraft({ kind: 'view', id: r.id });
  const orderByTable = new Map(
    (data.orders ?? []).filter((o) => o.tableId).map((o) => [o.tableId!, o]),
  );
  const tableKind = (t: DiningTable): TableKind => {
    const r = occupying.find((r) => r.table?.id === t.id);
    if (orderByTable.has(t.id) || r?.status === 'SEATED') return 'OCCUPIED';
    if (r) return 'RESERVED';
    if (t.needsCleaning) return 'CLEANING';
    return 'FREE';
  };
  const count = (kind: TableKind) => activeTables.filter((t) => tableKind(t) === kind).length;
  const toggleCleaning = (t: DiningTable) =>
    startCleaning(async () => {
      const result = await setTableCleaning(data.scopeKey, t.id, !t.needsCleaning);
      setCleaningError(result.error);
      if (!result.error) router.refresh();
    });
  // фокус возвращается на стол схемы, а не на кнопку закрытой карточки
  const focusTable = (id: string) =>
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(`[data-table-id="${id}"]`)?.focus(),
    );
  const panel = panelTable ? data.tables.find((t) => t.id === panelTable) : undefined;
  const shown = areas.filter((a) => !area || a.id === area);
  const spots = (tables: DiningTable[]) =>
    layoutSpots(tables.map((t) => ({ id: t.id, posX: t.posX ?? null, posY: t.posY ?? null })));
  /** Стол на плане: одна разметка для сетки и для схемы зала (§42) */
  const tableCard = (t: DiningTable) => {
    const r = occupying.find((x) => x.table?.id === t.id);
    const order = orderByTable.get(t.id);
    const kind = tableKind(t);
    const chairs = Math.min(t.capacity, 8);
    const caption = r
      ? `${clock(r.startsAt)} ${customer(r)}`
      : order
        ? `Заказ №${order.number}`
        : pluralRu(t.capacity, ['место', 'места', 'мест']);
    return (
      <div
        className="rest-fp-table"
        data-kind={kind}
        data-shape={SHAPE_CSS[tableShapeOf({ capacity: t.capacity, shape: t.shape ?? null })]}
        data-selected={panelTable === t.id || undefined}
        key={t.id}
      >
        <span className="rest-chairs" aria-hidden="true">
          {Array.from({ length: Math.ceil(chairs / 2) }, (_, i) => (
            <i key={i} />
          ))}
        </span>
        <button
          type="button"
          className="rest-fp-table__body"
          aria-label={`${t.name}, ${r ? foodStatus[r.status].label : KIND_LABEL[kind]}`}
          data-table-id={t.id}
          onClick={() => setPanelTable(t.id)}
        >
          <strong>{t.name.replace(/^Стол\s+/, '')}</strong>
        </button>
        <span className="rest-chairs" aria-hidden="true">
          {Array.from({ length: Math.floor(chairs / 2) }, (_, i) => (
            <i key={i} />
          ))}
        </span>
        <small className="rest-fp-table__caption">{caption}</small>
      </div>
    );
  };
  // зона, смена и статус: на компьютере в строке отборов, на телефоне в «Фильтрах» (эскиз 24.10.2026)
  const foodFilters = (
    <>
      <JournalFilter
        label="Зона"
        allLabel="Все зоны"
        value={area}
        onChange={setArea}
        options={areas.map((a) => ({ value: a.id, label: a.name }))}
      />
      <DayToolbar data={data} floor={floor} period={period} setPeriod={setPeriod} />
      <JournalFilter
        label="Статус брони"
        allLabel="Все статусы"
        value={status}
        onChange={setStatus}
        options={Object.entries(foodStatus).map(([value, { label }]) => ({ value, label }))}
      />
    </>
  );
  return (
    <div className="food-workspace rest-ws">
      <JournalHead
        title={floor ? 'План зала' : 'Бронирования'}
        subtitle={floor ? 'Бронирования столов и загрузка зала' : 'Расписание столов на день'}
        nav={
          <DayNav
            date={data.date}
            today={localInput(new Date().toISOString(), data.timezone).slice(0, 10)}
            testId="food-day-nav"
            onGo={(next) =>
              router.push(`${floor ? '/floor-plan' : '/table-reservations'}?date=${next}`)
            }
          />
        }
        actions={
          <>
            {/* на телефоне «Быстрый отчёт» не помещается в строку с «+ Новая бронь»: он в «Фильтрах», как в салоне */}
            {!narrow && <JournalExpandButton />}
            {!narrow && (
            <QuickReport
              text="Быстрый отчёт"
              key={`${data.scopeKey}:${data.date}`}
              date={data.date}
              scope={[
                'Бронирования столов',
                period
                  ? (data.periods.find((p) => p.id === period)?.name ?? 'Период')
                  : 'Все периоды',
                ...(area || status || search ? ['С учётом фильтров'] : []),
              ]}
              build={() => foodQuickReport(filtered.filter(onDay))}
            />
            )}
            {write && (
              <>
                {floor && (
                  <Button
                    tone="secondary"
                    onClick={() => setDraft({ kind: 'create', walkIn: true })}
                  >
                    Посадить без брони
                  </Button>
                )}
                <Button onClick={() => setDraft({ kind: 'create', walkIn: false })}>
                  <Icon name="plus" aria-hidden="true" />
                  Новая бронь
                </Button>
              </>
            )}
          </>
        }
        summary={
          <SummaryLine
            label="Сегодня в зале"
            testId="food-day-summary"
            parts={[
              {
                key: 'res',
                label: 'Броней',
                value: filtered.filter(onDay).filter((r) => ACTIVE.includes(r.status)).length,
              },
              {
                key: 'guests',
                label: 'гостей',
                value: filtered
                  .filter(onDay)
                  .filter((r) => ACTIVE.includes(r.status))
                  .reduce((n, r) => n + r.partySize, 0),
              },
              { key: 'seated', label: 'сидят', value: count('OCCUPIED') },
              {
                key: 'free',
                label: 'свободно столов',
                value: count('FREE'),
                after: ` из ${activeTables.length}`,
              },
              ...(count('CLEANING')
                ? [{ key: 'cleaning', label: 'на уборке', value: count('CLEANING') }]
                : []),
            ]}
          />
        }
        filters={
          <>
            {/* порядок отборов как у календаря гостиницы: поиск, где, когда, статус (решение 24.10.2026) */}
            <JournalSearch
              value={search}
              onChange={setSearch}
              label="Поиск гостя"
              placeholder={narrow ? 'Гость' : 'Гость, телефон'}
            />
            {foodFilters}
            <span className="journal-head__phone-only">
              <Help
                title={<FiltersTitle active={[area, status, period].filter(Boolean).length} />}
              >
                <span className="sr-only">Зона, смена и статус</span>
                {narrow && (
                  <div className="journal-head__phone-only">
                    <QuickReport
                      text="Быстрый отчёт"
                      key={`${data.scopeKey}:${data.date}:phone`}
                      date={data.date}
                      scope={[
                        'Бронирования столов',
                        period
                          ? (data.periods.find((p) => p.id === period)?.name ?? 'Период')
                          : 'Все периоды',
                        ...(area || status || search ? ['С учётом фильтров'] : []),
                      ]}
                      build={() => foodQuickReport(filtered.filter(onDay))}
                    />
                  </div>
                )}
              </Help>
            </span>
          </>
        }
        views={
          <>
            <Tabs
              label="Зал"
              items={[
                { href: `/floor-plan?date=${data.date}`, label: 'План зала', current: floor },
                {
                  href: `/table-reservations?date=${data.date}`,
                  label: 'Расписание',
                  current: !floor,
                },
              ]}
            />
            {!floor && (
              <Segmented
                label="Вид"
                value={view}
                onChange={setView}
                options={[
                  { value: 'timeline', label: 'Шкала' },
                  { value: 'list', label: 'Список' },
                ]}
              />
            )}
          </>
        }
      />
      {cleaningError && <Alert>{cleaningError}</Alert>}
      {!data.periods.some((p) => p.active) && <Notice>Настройте период обслуживания</Notice>}
      {floor ? (
        areas.length === 0 ? (
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
          <div className="rest-fp" data-card={panel ? 'open' : undefined}>
            <nav className="rest-fp__zones" aria-label="Зоны">
              {[{ id: '', name: 'Все зоны' }, ...areas].map((a) => (
                <button
                  type="button"
                  key={a.id || 'all'}
                  aria-pressed={area === a.id}
                  onClick={() => setArea(a.id)}
                >
                  <span className="rest-fp__zone-icon" aria-hidden="true">
                    <Icon name={a.id ? 'board' : 'inventory'} width={18} height={18} />
                  </span>
                  <span className="rest-fp__zone-text">
                    {a.name}
                    <small>
                      {pluralRu(
                        a.id
                          ? activeTables.filter((t) => t.areaId === a.id).length
                          : activeTables.length,
                        ['стол', 'стола', 'столов'],
                      )}
                    </small>
                  </span>
                </button>
              ))}
            </nav>
            <div className="rest-fp__canvas">
              {shown.map((a) => {
                const tables = activeTables.filter((t) => t.areaId === a.id);
                return (
                  <section key={a.id} aria-label={a.name} className="rest-fp__area">
                    {!area && <h2>{a.name}</h2>}
                    {editingArea === a.id ? (
                      <FloorLayoutEditor
                        scopeKey={data.scopeKey}
                        area={a}
                        tables={tables}
                        onClose={() => setEditingArea(null)}
                      />
                    ) : tables.length === 0 ? (
                      <p className="muted">В этой зоне пока нет столов</p>
                    ) : tables.some((t) => t.posX != null) ? (
                      <div className="rest-fp__layout">
                        {tables.map((t) => {
                          const p = spots(tables).get(t.id)!;
                          return (
                            <div
                              key={t.id}
                              className="rest-fp__spot"
                              style={spotStyle(p.x, p.y, t.scale ?? 100, t.rotation ?? 0)} /* slop-allow: inline-style место стола из схемы зала */
                            >
                              {tableCard(t)}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rest-fp__tables">{tables.map((t) => tableCard(t))}</div>
                    )}
                    {data.canProperty &&
                      !data.readOnly &&
                      editingArea !== a.id &&
                      tables.length > 0 && (
                        <Button size="sm" tone="secondary" onClick={() => setEditingArea(a.id)}>
                          {`Расставить столы: ${a.name}`}
                        </Button>
                      )}
                  </section>
                );
              })}
              <div className="rest-fp__legend" aria-label="Состояние столов">
                <span data-kind="FREE">
                  Свободен <strong>{count('FREE')}</strong>
                </span>
                <span data-kind="OCCUPIED">
                  Занят <strong>{count('OCCUPIED')}</strong>
                </span>
                <span data-kind="RESERVED">
                  Бронь <strong>{count('RESERVED')}</strong>
                </span>
                <span data-kind="CLEANING">
                  Уборка <strong>{count('CLEANING')}</strong>
                </span>
                <span>
                  Без стола <strong>{unassigned.length}</strong>
                </span>
              </div>
              {unassigned.length > 0 && (
                <div className="rest-fp__unassigned" aria-label="Брони без стола">
                  {unassigned.map((r) => (
                    <button className="food-reservation-card" key={r.id} onClick={() => open(r)}>
                      {clock(r.startsAt)}, {customer(r)}, {guests(r.partySize)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {panel && (
              <TablePanel
                table={panel}
                areaName={data.areas.find((a) => a.id === panel.areaId)?.name ?? ''}
                kind={tableKind(panel)}
                current={occupying.find((r) => r.table?.id === panel.id)}
                order={orderByTable.get(panel.id)}
                day={data.reservations
                  .filter((r) => r.table?.id === panel.id && ACTIVE.includes(r.status) && onDay(r))
                  .sort((a, b) => a.startsAt.localeCompare(b.startsAt))}
                write={write}
                clock={clock}
                close={() => {
                  setPanelTable(null);
                  focusTable(panel.id);
                }}
                openReservation={(r) => {
                  setPanelTable(null);
                  focusTable(panel.id);
                  requestAnimationFrame(() => open(r));
                }}
                openOrders={() => router.push('/orders')}
                book={() => {
                  setPanelTable(null);
                  focusTable(panel.id);
                  requestAnimationFrame(() =>
                    setDraft({ kind: 'create', walkIn: false, tableId: panel.id }),
                  );
                }}
                walkIn={() => {
                  setPanelTable(null);
                  focusTable(panel.id);
                  requestAnimationFrame(() =>
                    setDraft({ kind: 'create', walkIn: true, tableId: panel.id }),
                  );
                }}
                toggleCleaning={() => toggleCleaning(panel)}
                cleaningPending={cleaningPending}
              />
            )}
          </div>
        )
      ) : (
        <>
          {view === 'timeline' ? (
            <TimelineBoard
              data={data}
              reservations={filtered}
              areaId={area}
              onOpen={open}
              onCreate={
                write
                  ? (tableId, time) => setDraft({ kind: 'create', walkIn: false, tableId, time })
                  : null
              }
            />
          ) : !filtered.length ? (
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
                      {[
                        'Время',
                        'Клиент',
                        'Телефон',
                        'Гостей',
                        'Стол',
                        'Статус',
                        'Комментарий',
                        'Период',
                        'Источник',
                      ].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.id}>
                        <td>
                          {clock(r.startsAt)}–{clock(r.endsAt)}
                        </td>
                        <td>
                          <Button tone="ghost" onClick={() => open(r)}>
                            {customer(r)}
                          </Button>
                          <GuestMarks customer={r.customer} day={data.date} />
                        </td>
                        <td>{r.customer.phone ? formatPhone(r.customer.phone) : '—'}</td>
                        <td>{r.partySize}</td>
                        <td>{r.table ? `${r.table.areaName}, ${r.table.name}` : 'Без стола'}</td>
                        <td>
                          <StatusBadge kind="food" value={r.status} />
                        </td>
                        <td>{r.notes || '—'}</td>
                        <td>{r.servicePeriod.name}</td>
                        <td>{foodReservationOrigin(r)}</td>
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
                      <StatusBadge kind="food" value={r.status} />
                    </div>
                    <strong>{customer(r)}</strong>
                    <GuestMarks customer={r.customer} day={data.date} />
                    <span>{guests(r.partySize)}</span>
                    {r.customer.phone && <span>{formatPhone(r.customer.phone)}</span>}
                    {r.notes && <small>{r.notes}</small>}
                    <span>{r.table ? `${r.table.areaName}, ${r.table.name}` : 'Без стола'}</span>
                    <small>{r.servicePeriod.name}</small>
                    {r.employee && <small>Принял: {r.employee.name}</small>}
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
