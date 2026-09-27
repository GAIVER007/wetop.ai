'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { CategorySummary, InventoryUnit, InventoryCategory } from '../../lib/api';
import { Badge, Button, EmptyState, Input, Select, Table, cx } from '../../components/ui';
import { ActionMenu } from '../../components/action-menu';
import { Icon } from '../../components/icon';
import { displayDate } from '../../lib/display-date';
import { blockTypeLabel } from '../../lib/block-types';
import { pluralRu } from '../../lib/plural';
import { FundEditorDialog } from './fund-editor';

/**
 * Каталог фонда (ADR-106, срез I1): toolbar с фильтрами вместо постоянной левой панели,
 * таблица со структурой и живым состоянием места вместо 88 кнопок «Редактировать».
 * Фильтры живут в URL и не перезагружают данные.
 */
const HK_LABEL = {
  DIRTY: 'требует уборки',
  CLEAN: 'убрано',
  INSPECTED: 'проверено',
} as const;
const HK_TONE = { DIRTY: 'warn', CLEAN: 'neutral', INSPECTED: 'ok' } as const;
const HK_ICON = { DIRTY: 'dirty', CLEAN: 'clean', INSPECTED: 'inspected' } as const;

function StateCell({ unit }: { unit: InventoryUnit }) {
  if (!unit.active) return <Badge>в архиве</Badge>;
  if (unit.block)
    return (
      <span className="inventory-state">
        <Badge tone="danger">заблокирована</Badge>
        <span className="inventory-state-note">
          до <time dateTime={unit.block.dateTo}>{displayDate(unit.block.dateTo, 'numeric')}</time>
          {`, ${unit.block.reason || blockTypeLabel(unit.block.type)}`}
        </span>
      </span>
    );
  return <Badge tone="ok">в продаже</Badge>;
}

function HousekeepingCell({ unit }: { unit: InventoryUnit }) {
  return (
    <Badge tone={HK_TONE[unit.housekeepingStatus]} className="inventory-hk">
      <Icon name={HK_ICON[unit.housekeepingStatus]} width={14} height={14} />
      {HK_LABEL[unit.housekeepingStatus]}
    </Badge>
  );
}

/** Корпус и этаж строками, комната — только когда она не повторяет код места (ТЗ §11) */
function PlaceCell({ unit }: { unit: InventoryUnit }) {
  const floorRoom = [
    unit.floorName ? `этаж ${unit.floorName}` : '',
    unit.roomNumber && unit.roomNumber !== unit.code ? `комната ${unit.roomNumber}` : '',
  ]
    .filter(Boolean)
    .join(', ');
  if (!unit.buildingName && !floorRoom) return <>—</>;
  return (
    <span className="inventory-place">
      {unit.buildingName && <span>Корпус {unit.buildingName}</span>}
      {floorRoom && <span className="inventory-state-note">{floorRoom}</span>}
    </span>
  );
}

export function InventoryCatalog({
  units,
  categories,
  editorCategories,
}: {
  units: InventoryUnit[];
  categories: CategorySummary[];
  editorCategories: InventoryCategory[];
}) {
  const search = useSearchParams();
  const router = useRouter();
  const [editRoom, setEditRoom] = useState<InventoryUnit | null>(null);
  const category = search.get('category') ?? '';
  const kind = ['ROOM', 'BED'].includes(search.get('kind') ?? '') ? search.get('kind')! : '';
  const q = search.get('q') ?? '';
  const view = search.get('view') === 'cards' ? 'cards' : 'list';
  const query = q.trim().toLocaleLowerCase('ru');
  const filtered = units
    .filter(
      (unit) =>
        (!category || unit.accommodationTypeCode === category) &&
        (!kind || unit.kind === kind) &&
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
  const label = (unit: InventoryUnit) =>
    `Открыть ${unit.kind === 'BED' ? 'койко-место' : 'номер'} ${unit.code}`;
  const isFiltered = Boolean(category || kind || q);
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
    if ((e.target as HTMLElement).closest('a, button, [role="menu"]')) return;
    router.push(`/units/${encodeURIComponent(unit.code)}`);
  }
  return (
    <section className="inventory-content" aria-label="Каталог размещения">
      <div className="inventory-toolbar">
        <div className="inventory-search">
          <Icon name="search" />
          <Input
            type="search"
            aria-label="Поиск по номерному фонду"
            placeholder="Номер, койка, комната, категория"
            value={q}
            onChange={(e) => update('q', e.target.value, true)}
          />
        </div>
        <Select
          aria-label="Категория размещения"
          className="inventory-category-filter"
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
      <div className="inventory-filters">
        <div className="inventory-kind" role="group" aria-label="Тип размещения">
          {[
            ['', 'Все'],
            ['ROOM', 'Номера'],
            ['BED', 'Койко-места'],
          ].map(([value, text]) => (
            <button
              type="button"
              key={value}
              aria-label={text}
              aria-pressed={kind === value}
              className={cx(kind === value && 'is-selected')}
              onClick={() => update('kind', value!)}
            >
              {text}
              <span aria-hidden="true">
                {units.filter((u) => !value || u.kind === value).length}
              </span>
            </button>
          ))}
        </div>
        {isFiltered && (
          <Button tone="ghost" size="sm" onClick={reset}>
            Сбросить фильтры
          </Button>
        )}
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
            : 'Создайте категорию, затем добавьте номера или койки кнопкой «+ Добавить» — они сразу появятся на шахматке.'}
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
                        <HousekeepingCell unit={unit} />
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
              <th>Место</th>
              <th>Категория</th>
              <th>Расположение</th>
              <th>Вместимость</th>
              <th>Состояние</th>
              <th>Уборка</th>
              <th>
                <span className="sr-only">Действия</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((unit) => (
              <tr
                key={unit.code}
                data-testid="unit-row"
                className="inventory-row"
                onClick={(e) => rowClick(e, unit)}
              >
                <td>
                  <Link
                    prefetch={false}
                    href={`/units/${encodeURIComponent(unit.code)}`}
                    aria-label={label(unit)}
                    className="inventory-unit-link"
                  >
                    <Icon
                      name={unit.kind === 'ROOM' ? 'inventory' : 'bed'}
                      width={16}
                      height={16}
                    />
                    <strong>{unit.code}</strong>
                    <span>{unit.kind === 'ROOM' ? 'Номер' : 'Койко-место'}</span>
                  </Link>
                </td>
                <td>{unit.accommodationTypeName}</td>
                <td>
                  <PlaceCell unit={unit} />
                </td>
                <td>{guests(unit)}</td>
                <td>
                  <StateCell unit={unit} />
                </td>
                <td>
                  <HousekeepingCell unit={unit} />
                </td>
                <td className="inventory-actions">
                  <ActionMenu
                    size="sm"
                    label={`Действия: ${unit.code}`}
                    items={[
                      { label: 'Открыть', href: `/units/${encodeURIComponent(unit.code)}` },
                      {
                        label: 'Показать на шахматке',
                        href: `/chessboard?category=${encodeURIComponent(unit.accommodationTypeCode)}`,
                      },
                      { label: 'Переименовать комнату', onSelect: () => setEditRoom(unit) },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
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
