'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { CategorySummary, InventoryUnit, InventoryCategory } from '../../lib/api';
import { Badge, Button, EmptyState, Input, Select, Table, cx } from '../../components/ui';
import { ActionMenu } from '../../components/action-menu';
import { Icon } from '../../components/icon';
import { pluralRu } from '../../lib/plural';
import { FundEditorDialog } from './fund-editor';
import { HousekeepingBadge, UnitStateBadge, floorRoomText } from './unit-state';

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

export function InventoryCatalog({
  units,
  categories,
  editorCategories,
}: {
  units: InventoryUnit[];
  categories: CategorySummary[];
  editorCategories: InventoryCategory[];
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
  const category = search.get('category') ?? '';
  const kind = ['ROOM', 'BED'].includes(search.get('kind') ?? '') ? search.get('kind')! : '';
  const q = search.get('q') ?? '';
  const view = search.get('view') === 'cards' ? 'cards' : 'list';
  const building = search.get('building') ?? '';
  const floor = search.get('floor') ?? '';
  const state = search.get('state') ?? '';
  const housekeeping = search.get('housekeeping') ?? '';
  const query = q.trim().toLocaleLowerCase('ru');
  const filtered = units
    .filter(
      (unit) =>
        (!category || unit.accommodationTypeCode === category) &&
        (!kind || unit.kind === kind) &&
        (!building || unit.buildingName === building) &&
        (!floor || unit.floorName === floor) &&
        (!housekeeping || unit.housekeepingStatus === housekeeping) &&
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
  const label = (unit: InventoryUnit) =>
    `Открыть ${unit.kind === 'BED' ? 'койко-место' : 'номер'} ${unit.code}`;
  const isFiltered = Boolean(category || kind || q || building || floor || state || housekeeping);
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
        <details
          className="inventory-extra"
          open={Boolean(building || floor || state || housekeeping) || undefined}
        >
          <summary>
            Расположение и состояние
            {building || floor || state || housekeeping ? ' применены' : ''}
          </summary>
          <div className="inventory-extra-fields">
            <label>
              Корпус
              <Select
                aria-label="Фильтр по корпусу"
                value={building}
                onChange={(e) => update('building', e.target.value)}
              >
                <option value="">Все корпуса</option>
                {[...new Set(units.map((u) => u.buildingName).filter(Boolean))]
                  .sort()
                  .map((value) => (
                    <option key={value} value={value!}>
                      {value}
                    </option>
                  ))}
              </Select>
            </label>
            <label>
              Этаж
              <Select
                aria-label="Фильтр по этажу"
                value={floor}
                onChange={(e) => update('floor', e.target.value)}
              >
                <option value="">Все этажи</option>
                {[...new Set(units.map((u) => u.floorName).filter(Boolean))]
                  .sort((a, b) => a!.localeCompare(b!, 'ru', { numeric: true }))
                  .map((value) => (
                    <option key={value} value={value!}>
                      {value}
                    </option>
                  ))}
              </Select>
            </label>
            <label>
              Состояние
              <Select
                aria-label="Фильтр по состоянию"
                value={state}
                onChange={(e) => update('state', e.target.value)}
              >
                <option value="">Все состояния</option>
                <option value="sale">В продаже</option>
                <option value="blocked">Заблокированы</option>
                <option value="archived">В архиве</option>
              </Select>
            </label>
            <label>
              Уборка
              <Select
                aria-label="Фильтр по уборке"
                value={housekeeping}
                onChange={(e) => update('housekeeping', e.target.value)}
              >
                <option value="">Любая уборка</option>
                <option value="DIRTY">Требует уборки</option>
                <option value="CLEAN">Убрано</option>
                <option value="INSPECTED">Проверено</option>
              </Select>
            </label>
          </div>
        </details>
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
              <th>Место</th>
              <th>Расположение</th>
              <th>Состояние</th>
              <th>Уборка</th>
              <th>
                <span className="sr-only">Действия</span>
              </th>
            </tr>
          </thead>
          {/* Категория — заголовком группы с числом мест и вместимостью, как список категорий:
              имя один раз вместо колонки с повторами в каждой из 88 строк */}
          {[...groups]
            .filter(([, group]) => group.units.length > 0)
            .map(([code, group]) => (
              <tbody key={code}>
                <tr className="inventory-group-row" data-testid="category-group">
                  <th scope="colgroup" colSpan={5}>
                    {group.name}
                    <span>{groupMeta(code, group.units)}</span>
                  </th>
                </tr>
                {group.units.map((unit) => (
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
                      </Link>
                    </td>
                    <td>
                      <PlaceCell unit={unit} />
                    </td>
                    <td>
                      {unit.active && !unit.block ? (
                        <span className="inventory-state-note">в продаже</span>
                      ) : (
                        <UnitStateBadge active={unit.active} block={unit.block} />
                      )}
                    </td>
                    <td>
                      <HousekeepingBadge status={unit.housekeepingStatus} />
                    </td>
                    <td className="inventory-actions">
                      <ActionMenu
                        size="sm"
                        label={`Действия: ${unit.code}`}
                        items={[
                          // строка и ссылка открывают панель места; меню ведёт на полную карточку (ADR-108, I2)
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
      <FundEditorDialog
        categories={editorCategories}
        {...(editRoom ? { room: { code: editRoom.code, roomNumber: editRoom.roomNumber } } : {})}
        open={editRoom !== null}
        onClose={() => setEditRoom(null)}
      />
    </section>
  );
}
