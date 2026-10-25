'use client';
import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Button, EmptyState, Help, Notice, StatusBadge, Table } from '../../components/ui';
import { Icon } from '../../components/icon';
import { Segmented } from '../../components/segmented';
import { Tabs } from '../../components/tabs';
import { countLabel, msg } from '../../i18n';
import { useLocale, useT } from '../../i18n/locale-provider';
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
const SEAT_FORMS: [string, string, string] = [msg('место@@стол'), 'места', msg('мест@@стол')]; // kk-allow: форма склонения
const GUEST_FORMS: [string, string, string] = [msg('гость'), 'гостя', msg('гостей')]; // kk-allow: форма склонения
const TABLE_FORMS: [string, string, string] = [msg('стол'), 'стола', msg('столов')]; // kk-allow: форма склонения
const COLUMNS = [
  msg('Время'),
  msg('Клиент'),
  msg('Телефон'),
  msg('Гостей'),
  msg('Стол'),
  msg('Статус'),
  msg('Комментарий'),
  msg('Период'),
  msg('Источник'),
];

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
  const t = useT();
  const locale = useLocale();
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
  if (switching) return <p role="status">{t('Переключаем ресторан…')}</p>;
  const write = data.canDesk && !data.readOnly;
  const at = instantOf(`${data.date}T${data.time}`, data.timezone);
  // занятость стола считается по всем периодам, даже когда отбор периода скрывает брони списка
  const occupying = data.reservations.filter((r) => occupiedAt(r, at));
  const areas = data.areas.filter((a) => a.active).sort((a, b) => a.sortOrder - b.sortOrder);
  const activeTables = data.tables
    .filter((tb) => tb.active && areas.some((a) => a.id === tb.areaId))
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
  const guests = (n: number) => countLabel(locale, t, n, GUEST_FORMS);
  const clock = (iso: string) => localInput(iso, data.timezone).slice(11);
  const open = (r: RestaurantReservation) => setDraft({ kind: 'view', id: r.id });
  const orderByTable = new Map(
    (data.orders ?? []).filter((o) => o.tableId).map((o) => [o.tableId!, o]),
  );
  const tableKind = (tb: DiningTable): TableKind => {
    const r = occupying.find((r) => r.table?.id === tb.id);
    if (orderByTable.has(tb.id) || r?.status === 'SEATED') return 'OCCUPIED';
    if (r) return 'RESERVED';
    if (tb.needsCleaning) return 'CLEANING';
    return 'FREE';
  };
  const count = (kind: TableKind) => activeTables.filter((tb) => tableKind(tb) === kind).length;
  const toggleCleaning = (tb: DiningTable) =>
    startCleaning(async () => {
      const result = await setTableCleaning(data.scopeKey, tb.id, !tb.needsCleaning);
      setCleaningError(result.error);
      if (!result.error) router.refresh();
    });
  // фокус возвращается на стол схемы, а не на кнопку закрытой карточки
  const focusTable = (id: string) =>
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(`[data-table-id="${id}"]`)?.focus(),
    );
  const panel = panelTable ? data.tables.find((tb) => tb.id === panelTable) : undefined;
  const shown = areas.filter((a) => !area || a.id === area);
  const spots = (tables: DiningTable[]) =>
    layoutSpots(tables.map((tb) => ({ id: tb.id, posX: tb.posX ?? null, posY: tb.posY ?? null })));
  /** Стол на плане: одна разметка для сетки и для схемы зала (§42) */
  const tableCard = (tb: DiningTable) => {                  const r = occupying.find((x) => x.table?.id === tb.id);
                  const order = orderByTable.get(tb.id);
                  const kind = tableKind(tb);
                  const chairs = Math.min(tb.capacity, 8);
                  const caption = r
                    ? `${clock(r.startsAt)} ${customer(r)}`
                    : order
                      ? t('Заказ №{n}', { n: order.number })
                      : countLabel(locale, t, tb.capacity, SEAT_FORMS);
                  return (
                    <div
                      className="rest-fp-table"
                      data-kind={kind}
                      data-shape={SHAPE_CSS[tableShapeOf({ capacity: tb.capacity, shape: tb.shape ?? null })]}
                      data-selected={panelTable === tb.id || undefined}
                      key={tb.id}
                    >
                      <span className="rest-chairs" aria-hidden="true">
                        {Array.from({ length: Math.ceil(chairs / 2) }, (_, i) => (
                          <i key={i} />
                        ))}
                      </span>
                      <button
                        type="button"
                        className="rest-fp-table__body"
                        aria-label={`${tb.name}, ${t(r ? foodStatus[r.status].label : KIND_LABEL[kind])}`}
                        data-table-id={tb.id}
                        onClick={() => setPanelTable(tb.id)}
                      >
                        <strong>{tb.name.replace(/^Стол\s+/, '')}</strong>{/* kk-allow: номер стола из названия (данные) */}
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
        label={t('Зона')}
        allLabel={t('Все зоны')}
        value={area}
        onChange={setArea}
        options={areas.map((a) => ({ value: a.id, label: a.name }))}
      />
      <DayToolbar data={data} floor={floor} period={period} setPeriod={setPeriod} />
      <JournalFilter
        label={t('Статус брони')}
        allLabel={t('Все статусы')}
        value={status}
        onChange={setStatus}
        options={Object.entries(foodStatus).map(([value, { label }]) => ({ value, label }))}
      />
    </>
  );
  return (
    <div className="food-workspace rest-ws">
      <JournalHead
        title={floor ? t('План зала') : t('Бронирования')}
        subtitle={floor ? t('Бронирования столов и загрузка зала') : t('Расписание столов на день')}
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
              text={t('Быстрый отчёт')}
              key={`${data.scopeKey}:${data.date}`}
              date={data.date}
              scope={[
                t('Бронирования столов'),
                period
                  ? (data.periods.find((p) => p.id === period)?.name ?? t('Период'))
                  : t('Все периоды'),
                ...(area || status || search ? [t('С учётом фильтров')] : []),
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
                    {t('Посадить без брони')}
                  </Button>
                )}
                <Button onClick={() => setDraft({ kind: 'create', walkIn: false })}>
                  <Icon name="plus" aria-hidden="true" />
                  {t('Новая бронь')}
                </Button>
              </>
            )}
          </>
        }
        summary={
          <SummaryLine
            label={t('Сегодня в зале')}
            testId="food-day-summary"
            parts={[
              {
                key: 'res',
                label: t('Броней'),
                value: filtered.filter(onDay).filter((r) => ACTIVE.includes(r.status)).length,
              },
              {
                key: 'guests',
                label: t('гостей'),
                value: filtered
                  .filter(onDay)
                  .filter((r) => ACTIVE.includes(r.status))
                  .reduce((n, r) => n + r.partySize, 0),
              },
              { key: 'seated', label: t('сидят'), value: count('OCCUPIED') },
              {
                key: 'free',
                label: t('свободно столов'),
                value: count('FREE'),
                after: ` ${t('из {n}', { n: activeTables.length })}`,
              },
              ...(count('CLEANING')
                ? [{ key: 'cleaning', label: t('на уборке'), value: count('CLEANING') }]
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
              label={t('Поиск гостя')}
              placeholder={narrow ? t('Гость') : t('Гость, телефон')}
            />
            {foodFilters}
            <span className="journal-head__phone-only">
              <Help
                title={<FiltersTitle active={[area, status, period].filter(Boolean).length} />}
              >
                <span className="sr-only">{t('Зона, смена и статус')}</span>
                {narrow && (
                  <div className="journal-head__phone-only">
                    <QuickReport
                      text={t('Быстрый отчёт')}
                      key={`${data.scopeKey}:${data.date}:phone`}
                      date={data.date}
                      scope={[
                        t('Бронирования столов'),
                        period
                          ? (data.periods.find((p) => p.id === period)?.name ?? t('Период'))
                          : t('Все периоды'),
                        ...(area || status || search ? [t('С учётом фильтров')] : []),
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
              label={t('Зал')}
              items={[
                { href: `/floor-plan?date=${data.date}`, label: t('План зала'), current: floor },
                {
                  href: `/table-reservations?date=${data.date}`,
                  label: t('Расписание'),
                  current: !floor,
                },
              ]}
            />
            {!floor && (
              <Segmented
                label={t('Вид')}
                value={view}
                onChange={setView}
                options={[
                  { value: 'timeline', label: t('Шкала') },
                  { value: 'list', label: t('Список') },
                ]}
              />
            )}
          </>
        }
      />
      {cleaningError && <Alert>{cleaningError}</Alert>}
      {!data.periods.some((p) => p.active) && <Notice>{t('Настройте период обслуживания')}</Notice>}
      {floor ? (
        areas.length === 0 ? (
          <EmptyState
            title={t('Сначала добавьте зал и столы')}
            actions={
              data.canProperty && !data.readOnly ? (
                <Link className="btn" href="/dining-areas">
                  {t('Добавить зал')}
                </Link>
              ) : null
            }
          />
        ) : (
          <div className="rest-fp" data-card={panel ? 'open' : undefined}>
            <nav className="rest-fp__zones" aria-label={t('Зоны')}>
              {[{ id: '', name: t('Все зоны') }, ...areas].map((a) => (
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
                      {countLabel(
                        locale,
                        t,
                        a.id ? activeTables.filter((tb) => tb.areaId === a.id).length : activeTables.length,
                        TABLE_FORMS,
                      )}
                    </small>
                  </span>
                </button>
              ))}
            </nav>
            <div className="rest-fp__canvas">
              {shown.map((a) => {
                const tables = activeTables.filter((tb) => tb.areaId === a.id);
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
                      <p className="muted">{t('В этой зоне пока нет столов')}</p>
                    ) : tables.some((tb) => tb.posX != null) ? (
                      <div className="rest-fp__layout">
                        {tables.map((tb) => {
                          const p = spots(tables).get(tb.id)!;
                          return (
                            <div
                              key={tb.id}
                              className="rest-fp__spot"
                              style={spotStyle(p.x, p.y, tb.scale ?? 100, tb.rotation ?? 0)} /* slop-allow: inline-style место стола из схемы зала */
                            >
                              {tableCard(tb)}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rest-fp__tables">{tables.map((tb) => tableCard(tb))}</div>
                    )}
                    {data.canProperty && !data.readOnly && editingArea !== a.id && tables.length > 0 && (
                      <Button size="sm" tone="secondary" onClick={() => setEditingArea(a.id)}>
                        {t('Расставить столы: {name}', { name: a.name })}
                      </Button>
                    )}
                  </section>
                );
              })}
              <div className="rest-fp__legend" aria-label={t('Состояние столов')}>
                <span data-kind="FREE">
                  {t('Свободен')} <strong>{count('FREE')}</strong>
                </span>
                <span data-kind="OCCUPIED">
                  {t('Занят')} <strong>{count('OCCUPIED')}</strong>
                </span>
                <span data-kind="RESERVED">
                  {t('Бронь')} <strong>{count('RESERVED')}</strong>
                </span>
                <span data-kind="CLEANING">
                  {t('Уборка')} <strong>{count('CLEANING')}</strong>
                </span>
                <span>
                  {t('Без стола')} <strong>{unassigned.length}</strong>
                </span>
              </div>
              {unassigned.length > 0 && (
                <div className="rest-fp__unassigned" aria-label={t('Брони без стола')}>
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
                  ? t('Бронирования не найдены')
                  : t('На этот день бронирований нет')
              }
            />
          ) : (
            <>
              <div className="food-desktop-reservations">
                <Table>
                  <thead>
                    <tr>
                      {COLUMNS.map((h) => (
                        <th key={h}>{t(h)}</th>
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
                        <td>{r.table ? `${r.table.areaName}, ${r.table.name}` : t('Без стола')}</td>
                        <td>
                          <StatusBadge kind="food" value={r.status} />
                        </td>
                        <td>{r.notes || '—'}</td>
                        <td>{r.servicePeriod.name}</td>
                        <td>{foodReservationOrigin(r, t)}</td>
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
                    <span>{r.table ? `${r.table.areaName}, ${r.table.name}` : t('Без стола')}</span>
                    <small>{r.servicePeriod.name}</small>
                    {r.employee && <small>{t('Принял: {name}', { name: r.employee.name })}</small>}
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
