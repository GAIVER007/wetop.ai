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
import { countLabel, msg } from '../../i18n';
import { useLocale, useT } from '../../i18n/locale-provider';
import { useToast } from '../../components/toast';
import { bulkHousekeepingAction } from './actions';
import { FundEditorDialog } from './fund-editor';
import { HousekeepingBadge, buildingText, floorText, placeText } from './unit-state';
import { displayDate } from '../../lib/display-date';
import { blockTypeLabel } from '../../lib/block-types';

/**
 * Каталог фонда (ADR-108, срез I1): toolbar с фильтрами вместо постоянной левой панели,
 * таблица со структурой и живым состоянием места вместо 88 кнопок «Редактировать».
 * Фильтры живут в URL и не перезагружают данные.
 */
/** Расположение одной строкой; комната — только когда она не повторяет код места (ТЗ §11) */
function PlaceCell({ unit }: { unit: InventoryUnit }) {
  const t = useT();
  const text = placeText(unit, t);
  return <span className="inventory-place">{text || '—'}</span>;
}

type ChannelMark = { key: string; title: string; mark: string };

/** Проживание или бронь на сегодня одной ячейкой: точка статуса, слово, гость */
function OccupancyCell({ unit, occ }: { unit: InventoryUnit; occ: UnitOccupancy | undefined }) {
  const t = useT();
  if (!unit.active || unit.block) return <span className="inventory-state-note">—</span>;
  if (!occ || occ.state === 'FREE')
    return (
      <span className="inv-occ">
        <i className="inv-dot inv-dot--free" aria-hidden="true" />
        {t('Свободно')}
      </span>
    );
  return (
    <span className="inv-occ">
      <i
        className={cx('inv-dot', occ.state === 'STAYING' ? 'inv-dot--stay' : 'inv-dot--arrive')}
        aria-hidden="true"
      />
      <span className="inv-occ-text">
        <strong>{occ.state === 'STAYING' ? t('Проживает') : t('Заезд сегодня')}</strong>
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
  canEditCatalog,
  canHousekeeping,
}: {
  units: InventoryUnit[];
  categories: CategorySummary[];
  editorCategories: InventoryCategory[];
  occupancy?: UnitOccupancy[];
  channels?: ChannelMark[];
  channelCategories?: string[];
  canEditCatalog: boolean;
  canHousekeeping: boolean;
}) {
  // Пока открыта панель места (адрес `/units/<код>`), список под ней держит фильтры фонда, а не пустые
  // параметры адреса панели — иначе он перерисовывался бы целиком и терял место прокрутки (ADR-108, I2)
  const t = useT();
  const locale = useLocale();
  const live = useSearchParams();
  const pathname = usePathname();
  const kept = useRef(live);
  const openCode = pathname.startsWith('/units/') ? decodeURIComponent(pathname.slice(7)) : '';
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
    countLabel(
      locale,
      t,
      capacity.get(unit.accommodationTypeCode) ?? (unit.kind === 'BED' ? 1 : unit.roomCapacity),
      [msg('гость'), msg('гостя'), msg('гостей')],
    );
  /** Подпись заголовка группы: «36 койко-мест, 1 гость» — вместимость у категории одна */
  const groupMeta = (code: string, list: InventoryUnit[]) => {
    const count = countLabel(
      locale,
      t,
      list.length,
      list[0]!.kind === 'BED'
        ? [msg('койко-место'), msg('койко-места'), msg('койко-мест')]
        : [msg('номер'), msg('номера'), msg('номеров')],
    );
    const cap = capacity.get(code);
    return cap ? `${count}, ${countLabel(locale, t, cap, [msg('гость'), msg('гостя'), msg('гостей')])}` : count;
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
    ['', msg('Все'), units.length],
    ['ROOM', msg('Номера'), units.filter((u) => u.kind === 'ROOM').length],
    ['BED', msg('Койко-места'), units.filter((u) => u.kind === 'BED').length],
    ['blocked', msg('Недоступные'), units.filter((u) => u.active && u.block).length],
    [
      'dirty',
      msg('Требуют уборки'),
      units.filter((u) => u.active && u.housekeepingStatus === 'DIRTY').length,
    ],
    ['free', msg('Свободные'), units.filter(isFree).length],
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
    unit.kind === 'BED' ? t('Открыть койко-место {code}', { code: unit.code }) : t('Открыть номер {code}', { code: unit.code });
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
    if (!canHousekeeping) return;
    const codes = [...selected];
    startBulk(async () => {
      const r = await bulkHousekeepingAction(codes, status);
      toast({
        text: r.skipped
          ? `${t('{word}: {done} из {total}. Не прошли {skipped}', { word: t(word), done: r.done, total: codes.length, skipped: r.skipped })}${r.reason ? `: ${r.reason}` : ''}`
          : `${t(word)}: ${countLabel(locale, t, r.done, [msg('место'), msg('места'), msg('мест')])}`,
        tone: r.skipped ? 'warning' : 'success',
      });
      setSelected(new Set());
      router.refresh();
    });
  }
  return (
    <section className="inventory-content" aria-label={t('Каталог размещения')}>
      <div className="inventory-toolbar">
        <div className="inventory-search">
          <Icon name="search" />
          <Input
            type="search"
            aria-label={t('Поиск по номерному фонду')}
            placeholder={t('Поиск по номеру, койке, категории, корпусу...')}
            value={q}
            onChange={(e) => update('q', e.target.value, true)}
          />
        </div>
        <Select
          aria-label={t('Категория размещения')}
          className="inventory-filter"
          value={category}
          onChange={(e) => update('category', e.target.value)}
        >
          <option value="">{t('Все категории')}</option>
          {categories.map((c) => (
            <option key={c.code} value={c.code} data-testid="category-row">
              {c.name} ({c.units})
            </option>
          ))}
          {category && !categories.some((c) => c.code === category) && (
            <option value={category}>{t('Неизвестная категория')}</option>
          )}
        </Select>
        <Select
          aria-label={t('Фильтр по состоянию')}
          className="inventory-filter"
          value={state}
          onChange={(e) => update('state', e.target.value)}
        >
          <option value="">{t('Любой статус')}</option>
          <option value="sale">{t('В продаже')}</option>
          <option value="blocked">{t('Недоступны')}</option>
          <option value="archived">{t('В архиве')}</option>
        </Select>
        <Select
          aria-label={t('Фильтр по корпусу и этажу')}
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
          <option value="|">{t('Все корпуса / этажи')}</option>
          {places.map(([b, f]) => (
            <option key={`${b}|${f}`} value={`${b}|${f}`}>
              {[b && buildingText(b, t), f && floorText(f, t)].filter(Boolean).join(', ')}
            </option>
          ))}
        </Select>
        <Select
          aria-label={t('Фильтр по уборке')}
          className="inventory-filter"
          value={housekeeping}
          onChange={(e) => update('housekeeping', e.target.value)}
        >
          <option value="">{t('Любая уборка')}</option>
          <option value="DIRTY">{t('Требует уборки')}</option>
          <option value="CLEAN">{t('Убрано')}</option>
          <option value="INSPECTED">{t('Проверено')}</option>
        </Select>
        <Select
          aria-label={t('Фильтр по занятости')}
          className="inventory-filter"
          value={occupancyFilter}
          onChange={(e) => update('occupancy', e.target.value)}
        >
          <option value="">{t('Любая занятость')}</option>
          <option value="free">{t('Свободно')}</option>
          <option value="staying">{t('Проживает')}</option>
          <option value="arriving">{t('Заезд сегодня')}</option>
        </Select>
      </div>
      <div className="inventory-filters">
        <div className="inventory-kind" role="group" aria-label={t('Тип размещения')}>
          {tabs.map(([id, text, count]) => (
            <button
              type="button"
              key={id}
              aria-label={t(text)}
              aria-pressed={tab === id}
              className={cx(tab === id && 'is-selected')}
              onClick={() => pickTab(id)}
            >
              {t(text)}
              <span aria-hidden="true">{count}</span>
            </button>
          ))}
        </div>
        {isFiltered && (
          <Button tone="ghost" size="sm" onClick={reset}>
            {t('Сбросить фильтры')}
          </Button>
        )}
        <div className="seg" role="group" aria-label={t('Вид каталога')}>
          {(['list', 'cards'] as const).map((v) => (
            <button
              type="button"
              key={v}
              aria-pressed={view === v}
              className={cx('segment-button', view === v && 'is-on')}
              onClick={() => update('view', v === 'list' ? '' : v)}
            >
              <Icon name={v === 'cards' ? 'today' : 'menu'} width={16} height={16} />
              {v === 'cards' ? t('Карточки') : t('Список')}
            </button>
          ))}
        </div>
      </div>
      <div className="inventory-results" role="status" aria-live="polite">
        {t('Показано {n} из {total}', { n: filtered.length, total: units.length })}
      </div>
      {!filtered.length ? (
        <EmptyState
          icon={<Icon name="bed" />}
          title={units.length ? t('Ничего не найдено') : t('Номерной фонд пока пуст')}
        >
          {units.length
            ? t('Измените поиск или сбросьте фильтры.')
            : t('Создайте категорию, затем добавьте номера или койки кнопкой «+ Добавить» — они сразу появятся в календаре.')}
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
                        {unit.kind === 'ROOM' ? t('Номер') : t('Койко-место')}
                      </span>
                      <strong>{unit.code}</strong>
                      <span className="inventory-card-meta">{guests(unit)}</span>
                      {unit.roomNumber !== unit.code && (
                        <span className="inventory-card-room">{t('Комната {n}', { n: unit.roomNumber })}</span>
                      )}
                      <span className="inventory-card-state">
                        <HousekeepingBadge status={unit.housekeepingStatus} />
                        {unit.block && <Badge tone="danger">{t('заблокирована')}</Badge>}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
        </div>
      ) : (
        <Table className="inventory-table" aria-label={t('Номера и койко-места')}>
          <thead>
            <tr>
              {canHousekeeping && (
                <th className="inv-check">
                  <input
                    type="checkbox"
                    aria-label={t('Выбрать все показанные места')}
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(visibleCodes))}
                  />
                </th>
              )}
              <th>{t('Место')}</th>
              <th>{t('Тип')}</th>
              <th>{t('Расположение')}</th>
              <th>{t('Вместимость')}</th>
              <th>{t('Статус продажи')}</th>
              <th>{t('Проживание / бронь')}</th>
              <th>{t('Уборка')}</th>
              <th>{t('Каналы')}</th>
              <th>
                <span className="sr-only">{t('Действия')}</span>
              </th>
            </tr>
          </thead>
          {/* Категория заголовком группы с числом мест и вместимостью; группу можно свернуть */}
          {[...groups]
            .filter(([, group]) => group.units.length > 0)
            .map(([code, group]) => (
              <tbody key={code}>
                <tr className="inventory-group-row" data-testid="category-group">
                  <th scope="colgroup" colSpan={canHousekeeping ? 10 : 9}>
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
                      aria-current={openCode === unit.code ? 'true' : undefined}
                    >
                      {canHousekeeping && (
                        <td className="inv-check">
                          <input
                            type="checkbox"
                            aria-label={t('Выбрать {code}', { code: unit.code })}
                            checked={selected.has(unit.code)}
                            onChange={() => toggle(unit.code)}
                          />
                        </td>
                      )}
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
                          {unit.kind === 'ROOM' ? t('Номер') : t('Койко-место')}
                        </span>
                      </td>
                      <td>
                        <PlaceCell unit={unit} />
                      </td>
                      <td className="inv-num">{unit.kind === 'BED' ? 1 : unit.roomCapacity}</td>
                      <td>
                        {!unit.active ? (
                          <Badge>{t('В архиве')}</Badge>
                        ) : unit.block ? (
                          <Badge
                            tone="danger"
                            title={t('До {date}, {reason}', { date: displayDate(unit.block.dateTo, 'numeric'), reason: unit.block.reason || t(blockTypeLabel(unit.block.type)) })}
                          >
                            {t('Недоступно')}
                          </Badge>
                        ) : (
                          <Badge tone="ok">{t('В продаже')}</Badge>
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
                          label={t('Действия: {code}', { code: unit.code })}
                          items={[
                            {
                              label: t('Полная карточка'),
                              href: `/units/${encodeURIComponent(unit.code)}`,
                            },
                            {
                              label: t('Показать в календаре'),
                              href: `/chessboard?category=${encodeURIComponent(unit.accommodationTypeCode)}`,
                            },
                            ...(canEditCatalog
                              ? [
                                  {
                                    label: t('Переименовать комнату'),
                                    onSelect: () => setEditRoom(unit),
                                  },
                                ]
                              : []),
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
              </tbody>
            ))}
        </Table>
      )}
      {canHousekeeping && selected.size > 0 && (
        <div className="inv-bulk" role="region" aria-label={t('Массовые действия')}>
          <span>{t('Выбрано {items}', { items: countLabel(locale, t, selected.size, [msg('объект'), msg('объекта'), msg('объектов')]) })}</span>
          <Button
            tone="secondary"
            size="sm"
            disabled={bulkPending}
            onClick={() => bulkHousekeeping('DIRTY', msg('Назначена уборка'))}
          >
            <Icon name="dirty" width={16} height={16} />
            {t('Назначить уборку')}
          </Button>
          <ActionMenu
            text={msg('Изменить статус уборки')}
            label={msg('Изменить статус уборки выбранных мест')}
            items={[
              { label: t('Убрано'), onSelect: () => bulkHousekeeping('CLEAN', msg('Убрано')) },
              { label: t('Проверено'), onSelect: () => bulkHousekeeping('INSPECTED', msg('Проверено')) },
            ]}
          />
          <Button tone="ghost" size="sm" onClick={() => setSelected(new Set())}>
            {t('Снять выбор')}
          </Button>
        </div>
      )}
      {canEditCatalog && (
        <FundEditorDialog
          categories={editorCategories}
          {...(editRoom
            ? { room: { code: editRoom.code, roomNumber: editRoom.roomNumber } }
            : {})}
          open={editRoom !== null}
          onClose={() => setEditRoom(null)}
        />
      )}
    </section>
  );
}
