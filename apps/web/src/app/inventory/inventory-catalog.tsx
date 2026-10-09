'use client';
import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type {
  CategorySummary,
  InventoryUnit,
  InventoryCategory,
  UnitOccupancy,
} from '../../lib/api';
import { Badge, Button, EmptyState, Input, Select, Table, cx } from '../../components/ui';
import { ActionMenu } from '../../components/action-menu';
import { Icon } from '../../components/icon';
import { pluralRu } from '../../lib/plural';
import { useToast } from '../../components/toast';
import { bulkHousekeepingAction } from './actions';
import { FundEditorDialog } from './fund-editor';
import { HousekeepingBadge, floorRoomText } from './unit-state';
import { displayDate } from '../../lib/display-date';
import { blockTypeLabel } from '../../lib/block-types';

/**
 * Каталог фонда (ADR-108, срез I1): toolbar с фильтрами вместо постоянной левой панели,
 * таблица со структурой и живым состоянием места вместо 88 кнопок «Редактировать».
 * Фильтры живут в URL и не перезагружают данные.
 */
/** Расположение одной строкой; комната — только когда она не повторяет код места (ТЗ §11) */
function PlaceCell({ unit }: { unit: InventoryUnit }) {
  const text = [unit.buildingName && `Корпус ${unit.buildingName}`, floorRoomText(unit)]
    .filter(Boolean)
    .join(', ');
  return <span className="inventory-place">{text || '—'}</span>;
}

type ChannelMark = { key: string; title: string; mark: string };

/** Проживание или бронь на сегодня одной ячейкой: точка статуса, слово, гость */
function OccupancyCell({ unit, occ }: { unit: InventoryUnit; occ: UnitOccupancy | undefined }) {
  if (!unit.active || unit.block) return <span className="inventory-state-note">—</span>;
  if (!occ || occ.state === 'FREE')
    return (
      <span className="inv-occ">
        <i className="inv-dot inv-dot--free" aria-hidden="true" />
        Свободно
      </span>
    );
  return (
    <span className="inv-occ">
      <i
        className={cx('inv-dot', occ.state === 'STAYING' ? 'inv-dot--stay' : 'inv-dot--arrive')}
        aria-hidden="true"
      />
      <span className="inv-occ-text">
        <strong>{occ.state === 'STAYING' ? 'Проживает' : 'Заезд сегодня'}</strong>
        {occ.guest && <span>{occ.guest}</span>}
      </span>
    </span>
  );
}

/** «Свободно» только для места в продаже без блокировки и без гостя на сегодня */
function matchOccupancy(unit: InventoryUnit, o: UnitOccupancy | undefined, filter: string) {
  if (!unit.active || unit.block) return false;
  const state = o?.state ?? 'FREE';
  return state === filter.toUpperCase();
}

export function InventoryCatalog({
  units,
  categories,
  editorCategories,
  occupancy = [],
  channels = [],
  channelCategories = [],
}: {
  units: InventoryUnit[];
  categories: CategorySummary[];
  editorCategories: InventoryCategory[];
  occupancy?: UnitOccupancy[];
  channels?: ChannelMark[];
  channelCategories?: string[];
}) {
  // Пока открыта панель места (адрес `/units/<код>`), список под ней держит фильтры фонда, а не пустые
  // параметры адреса панели — иначе он перерисовывался бы целиком и терял место прокрутки (ADR-108, I2)
  const live = useSearchParams();
  const pathname = usePathname();
  const kept = useRef(live);
  if (pathname === '/inventory') kept.current = live;
  const search = kept.current;
  const router = useRouter();
  const [editRoom, setEditRoom] = useState<InventoryUnit | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, startBulk] = useTransition();
  const { toast } = useToast();
  const occ = new Map(occupancy.map((o) => [o.code, o]));
  const mapped = new Set(channelCategories);
  const category = search.get('category') ?? '';
  const kind = ['ROOM', 'BED'].includes(search.get('kind') ?? '') ? search.get('kind')! : '';
  const q = search.get('q') ?? '';
  const view = search.get('view') === 'cards' ? 'cards' : 'list';
  const building = search.get('building') ?? '';
  const floor = search.get('floor') ?? '';
  const state = search.get('state') ?? '';
  const housekeeping = search.get('housekeeping') ?? '';
  const occupancyFilter = ['free', 'staying', 'arriving'].includes(search.get('occupancy') ?? '')
    ? search.get('occupancy')!
    : '';
  const query = q.trim().toLocaleLowerCase('ru');
  const filtered = units
    .filter(
      (unit) =>
        (!category || unit.accommodationTypeCode === category) &&
        (!kind || unit.kind === kind) &&
        (!building || unit.buildingName === building) &&
        (!floor || unit.floorName === floor) &&
        (!housekeeping || unit.housekeepingStatus === housekeeping) &&
        (!occupancyFilter || matchOccupancy(unit, occ.get(unit.code), occupancyFilter)) &&
        (!state ||
          (state === 'blocked'
            ? Boolean(unit.block)
            : state === 'archived'
              ? !unit.active
              : unit.active && !unit.block)) &&
        `${unit.code} ${unit.roomNumber} ${unit.accommodationTypeName}`
          .toLocaleLowerCase('ru')
          .includes(query),
    )
    .sort((a, b) => a.code.localeCompare(b.code, 'ru', { numeric: true }));
  const groups = new Map<string, { name: string; units: InventoryUnit[] }>(
    categories.map((c) => [c.code, { name: c.name, units: [] }]),
  );
  for (const unit of filtered) {
    const group = groups.get(unit.accommodationTypeCode) ?? {
      name: unit.accommodationTypeName,
      units: [],
    };
    group.units.push(unit);
    groups.set(unit.accommodationTypeCode, group);
  }
  const capacity = new Map(categories.map((c) => [c.code, c.capacityAdults]));
  const guests = (unit: InventoryUnit) =>
    pluralRu(
      capacity.get(unit.accommodationTypeCode) ?? (unit.kind === 'BED' ? 1 : unit.roomCapacity),
      ['гость', 'гостя', 'гостей'],
    );
  /** Подпись заголовка группы: «36 койко-мест, 1 гость» — вместимость у категории одна */
  const groupMeta = (code: string, list: InventoryUnit[]) => {
    const count = pluralRu(
      list.length,
      list[0]!.kind === 'BED'
        ? ['койко-место', 'койко-места', 'койко-мест']
        : ['номер', 'номера', 'номеров'],
    );
    const cap = capacity.get(code);
    return cap ? `${count}, ${pluralRu(cap, ['гость', 'гостя', 'гостей'])}` : count;
  };
  const places = [
    ...new Map(
      units
        .filter((u) => u.buildingName || u.floorName)
        .map(
          (u) =>
            [
              `${u.buildingName ?? ''}|${u.floorName ?? ''}`,
              [u.buildingName ?? '', u.floorName ?? ''],
            ] as const,
        ),
    ).values(),
  ].sort(
    (x, y) => x[0].localeCompare(y[0], 'ru') || x[1].localeCompare(y[1], 'ru', { numeric: true }),
  );
  const isFree = (u: InventoryUnit) => matchOccupancy(u, occ.get(u.code), 'free');
  const tab = kind
    ? kind
    : state === 'blocked' && !housekeeping && !occupancyFilter
      ? 'blocked'
      : housekeeping === 'DIRTY' && !state && !occupancyFilter
        ? 'dirty'
        : occupancyFilter === 'free' && !state && !housekeeping
          ? 'free'
          : !state && !housekeeping && !occupancyFilter
            ? ''
            : 'custom';
  const tabs: Array<[string, string, number]> = [
    ['', 'Все', units.length],
    ['ROOM', 'Номера', units.filter((u) => u.kind === 'ROOM').length],
    ['BED', 'Койко-места', units.filter((u) => u.kind === 'BED').length],
    ['blocked', 'Недоступные', units.filter((u) => u.active && u.block).length],
    [
      'dirty',
      'Требуют уборки',
      units.filter((u) => u.active && u.housekeepingStatus === 'DIRTY').length,
    ],
    ['free', 'Свободные', units.filter(isFree).length],
  ];
  /** Вкладка задаёт ровно свой фильтр и снимает остальные фильтры вкладок */
  function pickTab(id: string) {
    const params = new URLSearchParams(search.toString());
    for (const key of ['kind', 'state', 'housekeeping', 'occupancy']) params.delete(key);
    if (id === 'ROOM' || id === 'BED') params.set('kind', id);
    if (id === 'blocked') params.set('state', 'blocked');
    if (id === 'dirty') params.set('housekeeping', 'DIRTY');
    if (id === 'free') params.set('occupancy', 'free');
    window.history.pushState(null, '', `/inventory${params.size ? `?${params}` : ''}`);
  }
  const label = (unit: InventoryUnit) =>
    `Открыть ${unit.kind === 'BED' ? 'койко-место' : 'номер'} ${unit.code}`;
  const isFiltered = Boolean(
    category || kind || q || building || floor || state || housekeeping || occupancyFilter,
  );
  function update(key: string, value: string, replace = false) {
    const params = new URLSearchParams(search.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const url = `/inventory${params.size ? `?${params}` : ''}`;
    if (replace) window.history.replaceState(null, '', url);
    else window.history.pushState(null, '', url);
  }
  function reset() {
    window.history.pushState(null, '', view === 'cards' ? '/inventory?view=cards' : '/inventory');
  }
  /** Строка открывает карточку места; клик по ссылке, кнопке или меню остаётся за ними */
  function rowClick(e: React.MouseEvent, unit: InventoryUnit) {
    if ((e.target as HTMLElement).closest('a, button, input, label, [role="menu"]')) return;
    router.push(`/units/${encodeURIComponent(unit.code)}`);
  }
  const visibleCodes = filtered.map((u) => u.code);
  const allSelected = visibleCodes.length > 0 && visibleCodes.every((c) => selected.has(c));
  const toggle = (code: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(code)) next.add(code);
      return next;
    });
  function bulkHousekeeping(status: string, word: string) {
    const codes = [...selected];
    startBulk(async () => {
      const r = await bulkHousekeepingAction(codes, status);
      toast({
        text: r.skipped
          ? `${word}: ${r.done} из ${codes.length}. Не прошли ${r.skipped}${r.reason ? `: ${r.reason}` : ''}`
          : `${word}: ${pluralRu(r.done, ['место', 'места', 'мест'])}`,
        tone: r.skipped ? 'warning' : 'success',
      });
      setSelected(new Set());
      router.refresh();
    });
  }
  return (
    <section className="inventory-content" aria-label="Каталог размещения">
      <div className="inventory-toolbar">
        <div className="inventory-search">
          <Icon name="search" />
          <Input
            type="search"
            aria-label="Поиск по номерному фонду"
            placeholder="Поиск по номеру, койке, категории, корпусу..."
            value={q}
            onChange={(e) => update('q', e.target.value, true)}
          />
        </div>
        <Select
          aria-label="Категория размещения"
          className="inventory-filter"
          value={category}
          onChange={(e) => update('category', e.target.value)}
        >
          <option value="">Все категории</option>
          {categories.map((c) => (
            <option key={c.code} value={c.code} data-testid="category-row">
              {c.name} ({c.units})
            </option>
          ))}
          {category && !categories.some((c) => c.code === category) && (
            <option value={category}>Неизвестная категория</option>
          )}
        </Select>
        <Select
          aria-label="Фильтр по состоянию"
          className="inventory-filter"
          value={state}
          onChange={(e) => update('state', e.target.value)}
        >
          <option value="">Любой статус</option>
          <option value="sale">В продаже</option>
          <option value="blocked">Недоступны</option>
          <option value="archived">В архиве</option>
        </Select>
        <Select
          aria-label="Фильтр по корпусу и этажу"
          className="inventory-filter"
          value={`${building}|${floor}`}
          onChange={(e) => {
            const [b = '', f = ''] = e.target.value.split('|');
            const params = new URLSearchParams(search.toString());
            for (const [key, value] of [
              ['building', b],
              ['floor', f],
            ] as const) {
              if (value) params.set(key, value);
              else params.delete(key);
            }
            window.history.pushState(null, '', `/inventory${params.size ? `?${params}` : ''}`);
          }}
        >
          <option value="|">Все корпуса / этажи</option>
          {places.map(([b, f]) => (
            <option key={`${b}|${f}`} value={`${b}|${f}`}>
              {[b && `Корпус ${b}`, f && `этаж ${f}`].filter(Boolean).join(', ')}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Фильтр по уборке"
          className="inventory-filter"
          value={housekeeping}
          onChange={(e) => update('housekeeping', e.target.value)}
        >
          <option value="">Любая уборка</option>
          <option value="DIRTY">Требует уборки</option>
          <option value="CLEAN">Убрано</option>
          <option value="INSPECTED">Проверено</option>
        </Select>
        <Select
          aria-label="Фильтр по занятости"
          className="inventory-filter"
          value={occupancyFilter}
          onChange={(e) => update('occupancy', e.target.value)}
        >
          <option value="">Любая занятость</option>
          <option value="free">Свободно</option>
          <option value="staying">Проживает</option>
          <option value="arriving">Заезд сегодня</option>
        </Select>
      </div>
      <div className="inventory-filters">
        <div className="inventory-kind" role="group" aria-label="Тип размещения">
          {tabs.map(([id, text, count]) => (
            <button
              type="button"
              key={id}
              aria-label={text}
              aria-pressed={tab === id}
              className={cx(tab === id && 'is-selected')}
              onClick={() => pickTab(id)}
            >
              {text}
              <span aria-hidden="true">{count}</span>
            </button>
          ))}
        </div>
        {isFiltered && (
          <Button tone="ghost" size="sm" onClick={reset}>
            Сбросить фильтры
          </Button>
        )}
        <div className="seg" role="group" aria-label="Вид каталога">
          {(['list', 'cards'] as const).map((v) => (
            <button
              type="button"
              key={v}
              aria-pressed={view === v}
              className={cx('segment-button', view === v && 'is-on')}
              onClick={() => update('view', v === 'list' ? '' : v)}
            >
              <Icon name={v === 'cards' ? 'today' : 'menu'} width={16} height={16} />
              {v === 'cards' ? 'Карточки' : 'Список'}
            </button>
          ))}
        </div>
      </div>
      <div className="inventory-results" role="status" aria-live="polite">
        Показано {filtered.length} из {units.length}
      </div>
      {!filtered.length ? (
        <EmptyState
          icon={<Icon name="bed" />}
          title={units.length ? 'Ничего не найдено' : 'Номерной фонд пока пуст'}
        >
          {units.length
            ? 'Измените поиск или сбросьте фильтры.'
            : 'Создайте категорию, затем добавьте номера или койки кнопкой «+ Добавить» — они сразу появятся в календаре.'}
        </EmptyState>
      ) : view === 'cards' ? (
        <div className="inventory-groups">
          {[...groups]
            .filter(([, group]) => group.units.length > 0)
            .map(([code, group], index) => (
              <section
                className="inventory-group"
                key={code}
                aria-labelledby={`inventory-group-${index}`}
              >
                <div className="inventory-group-heading">
                  <h2 id={`inventory-group-${index}`}>{group.name}</h2>
                  <span>{group.units.length}</span>
                </div>
                <div className="inventory-cards">
                  {group.units.map((unit) => (
                    <Link
                      key={unit.code}
                      href={`/units/${encodeURIComponent(unit.code)}`}
                      prefetch={false}
                      className="inventory-card"
                      data-testid="unit-row"
                      aria-label={label(unit)}
                      aria-describedby={`inventory-group-${index}`}
                    >
                      <span className="inventory-card-type">
                        <Icon
                          name={unit.kind === 'ROOM' ? 'inventory' : 'bed'}
                          width={16}
                          height={16}
                        />
                        {unit.kind === 'ROOM' ? 'Номер' : 'Койко-место'}
                      </span>
                      <strong>{unit.code}</strong>
                      <span className="inventory-card-meta">{guests(unit)}</span>
                      {unit.roomNumber !== unit.code && (
                        <span className="inventory-card-room">Комната {unit.roomNumber}</span>
                      )}
                      <span className="inventory-card-state">
                        <HousekeepingBadge status={unit.housekeepingStatus} />
                        {unit.block && <Badge tone="danger">заблокирована</Badge>}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
        </div>
      ) : (
        <Table className="inventory-table" aria-label="Номера и койко-места">
          <thead>
            <tr>
              <th className="inv-check">
                <input
                  type="checkbox"
                  aria-label="Выбрать все показанные места"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(visibleCodes))}
                />
              </th>
              <th>Место</th>
              <th>Тип</th>
              <th>Расположение</th>
              <th>Вместимость</th>
              <th>Статус продажи</th>
              <th>Проживание / бронь</th>
              <th>Уборка</th>
              <th>Каналы</th>
              <th>
                <span className="sr-only">Действия</span>
              </th>
            </tr>
          </thead>
          {/* Категория заголовком группы с числом мест и вместимостью; группу можно свернуть */}
          {[...groups]
            .filter(([, group]) => group.units.length > 0)
            .map(([code, group]) => (
              <tbody key={code}>
                <tr className="inventory-group-row" data-testid="category-group">
                  <th scope="colgroup" colSpan={10}>
                    <button
                      type="button"
                      className="inv-group-toggle"
                      aria-expanded={!collapsed.has(code)}
                      onClick={() =>
                        setCollapsed((prev) => {
                          const next = new Set(prev);
                          if (!next.delete(code)) next.add(code);
                          return next;
                        })
                      }
                    >
                      <Icon name="down" width={16} height={16} className="inv-group-chevron" />
                      <Icon
                        name={group.units[0]!.kind === 'BED' ? 'bed' : 'inventory'}
                        width={16}
                        height={16}
                      />
                      {group.name}
                    </button>
                    <span>{groupMeta(code, group.units)}</span>
                  </th>
                </tr>
                {!collapsed.has(code) &&
                  group.units.map((unit) => (
                    <tr
                      key={unit.code}
                      data-testid="unit-row"
                      className="inventory-row"
                      onClick={(e) => rowClick(e, unit)}
                      aria-selected={selected.has(unit.code)}
                    >
                      <td className="inv-check">
                        <input
                          type="checkbox"
                          aria-label={`Выбрать ${unit.code}`}
                          checked={selected.has(unit.code)}
                          onChange={() => toggle(unit.code)}
                        />
                      </td>
                      <td>
                        <Link
                          prefetch={false}
                          href={`/units/${encodeURIComponent(unit.code)}`}
                          aria-label={label(unit)}
                          className="inventory-unit-link"
                        >
                          <strong>{unit.code}</strong>
                        </Link>
                      </td>
                      <td>
                        <span className="inv-type">
                          <Icon
                            name={unit.kind === 'ROOM' ? 'inventory' : 'bed'}
                            width={16}
                            height={16}
                          />
                          {unit.kind === 'ROOM' ? 'Номер' : 'Койко-место'}
                        </span>
                      </td>
                      <td>
                        <PlaceCell unit={unit} />
                      </td>
                      <td className="inv-num">{unit.kind === 'BED' ? 1 : unit.roomCapacity}</td>
                      <td>
                        {!unit.active ? (
                          <Badge>В архиве</Badge>
                        ) : unit.block ? (
                          <Badge
                            tone="danger"
                            title={`До ${displayDate(unit.block.dateTo, 'numeric')}, ${unit.block.reason || blockTypeLabel(unit.block.type)}`}
                          >
                            Недоступно
                          </Badge>
                        ) : (
                          <Badge tone="ok">В продаже</Badge>
                        )}
                      </td>
                      <td>
                        <OccupancyCell unit={unit} occ={occ.get(unit.code)} />
                      </td>
                      <td>
                        <HousekeepingBadge status={unit.housekeepingStatus} />
                      </td>
                      <td>
                        <span className="inv-channels">
                          {mapped.has(unit.accommodationTypeCode) && channels.length ? (
                            channels.map((c) => (
                              <span key={c.key} className="inv-channel" title={c.title}>
                                {c.mark}
                              </span>
                            ))
                          ) : (
                            <span className="inventory-state-note">—</span>
                          )}
                        </span>
                      </td>
                      <td className="inventory-actions">
                        <ActionMenu
                          size="sm"
                          label={`Действия: ${unit.code}`}
                          items={[
                            {
                              label: 'Полная карточка',
                              href: `/units/${encodeURIComponent(unit.code)}`,
                            },
                            {
                              label: 'Показать в календаре',
                              href: `/chessboard?category=${encodeURIComponent(unit.accommodationTypeCode)}`,
                            },
                            { label: 'Переименовать комнату', onSelect: () => setEditRoom(unit) },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
              </tbody>
            ))}
        </Table>
      )}
      {selected.size > 0 && (
        <div className="inv-bulk" role="region" aria-label="Массовые действия">
          <span>Выбрано {pluralRu(selected.size, ['объект', 'объекта', 'объектов'])}</span>
          <Button
            tone="secondary"
            size="sm"
            disabled={bulkPending}
            onClick={() => bulkHousekeeping('DIRTY', 'Назначена уборка')}
          >
            <Icon name="dirty" width={16} height={16} />
            Назначить уборку
          </Button>
          <ActionMenu
            text="Изменить статус уборки"
            label="Изменить статус уборки выбранных мест"
            items={[
              { label: 'Убрано', onSelect: () => bulkHousekeeping('CLEAN', 'Убрано') },
              { label: 'Проверено', onSelect: () => bulkHousekeeping('INSPECTED', 'Проверено') },
            ]}
          />
          <Button tone="ghost" size="sm" onClick={() => setSelected(new Set())}>
            Снять выбор
          </Button>
        </div>
      )}
      <FundEditorDialog
        categories={editorCategories}
        {...(editRoom ? { room: { code: editRoom.code, roomNumber: editRoom.roomNumber } } : {})}
        open={editRoom !== null}
        onClose={() => setEditRoom(null)}
      />
    </section>
  );
}
