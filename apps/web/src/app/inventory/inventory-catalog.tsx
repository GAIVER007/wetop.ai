'use client';
import { FundEditor } from './fund-editor';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { CategorySummary, InventoryUnit, InventoryCategory } from '../../lib/api';
import { Button, EmptyState, Input, Select, Table, cx } from '../../components/ui';
import { Icon } from '../../components/icon';
import { pluralRu } from '../../lib/plural';

/** Только отображение: фильтры в URL не меняют фонд и не требуют перезагрузки API. */
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
    window.history.pushState(null, '', view === 'list' ? '/inventory?view=list' : '/inventory');
  }
  return (
    <div className="inventory-layout">
      <aside className="inventory-categories" aria-label="Категории размещения">
        <div className="inventory-categories-title">
          <h2>Категории</h2>
          <span>{categories.length}</span>
        </div>
        <div className="inventory-category-buttons">
          <button
            type="button"
            className={cx('inventory-category', !category && 'is-selected')}
            aria-pressed={!category}
            onClick={() => update('category', '')}
          >
            <Icon name="inventory" />
            <span>Весь номерной фонд</span>
            <b>{units.length}</b>
          </button>
          {categories.map((c) => (
            <button
              key={c.code}
              type="button"
              data-testid="category-row"
              className={cx('inventory-category', c.code === category && 'is-selected')}
              aria-pressed={c.code === category}
              onClick={() => update('category', c.code)}
            >
              <Icon
                name={
                  units.some((u) => u.accommodationTypeCode === c.code && u.kind === 'BED')
                    ? 'bed'
                    : 'inventory'
                }
              />
              <span>{c.name}</span>
              <b>{c.units}</b>
            </button>
          ))}
        </div>
        <div className="inventory-category-select">
          <Select
            aria-label="Категория размещения"
            value={category}
            onChange={(e) => update('category', e.target.value)}
          >
            <option value="">Все категории</option>
            {categories.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.units})
              </option>
            ))}
            {category && !categories.some((c) => c.code === category) && (
              <option value={category}>Неизвестная категория</option>
            )}
          </Select>
        </div>
        <p className="inventory-help">
          Уборка, блокировки и проживания — в карточке номера или койко-места.
        </p>
      </aside>
      <section className="inventory-content" aria-label="Каталог размещения">
        <div className="inventory-toolbar">
          <div className="inventory-search">
            <Icon name="search" />
            <Input
              type="search"
              aria-label="Поиск по номерному фонду"
              placeholder="Номер, комната или категория"
              value={q}
              onChange={(e) => update('q', e.target.value, true)}
            />
          </div>
          <div className="seg" role="group" aria-label="Вид каталога">
            {(['cards', 'list'] as const).map((v) => (
              <button
                type="button"
                key={v}
                aria-pressed={view === v}
                className={cx('segment-button', view === v && 'is-on')}
                onClick={() => update('view', v)}
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
              : 'Добавьте номер или койки кнопкой «+ Номер / койки» — они сразу появятся на шахматке.'}
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
                <th>Номер / место</th>
                <th>Категория</th>
                <th>Комната</th>
                <th>Размещение</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((unit) => (
                <tr key={unit.code} data-testid="unit-row">
                  <td>
                    <Link
                      prefetch={false}
                      href={`/units/${encodeURIComponent(unit.code)}`}
                      aria-label={label(unit)}
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
                  <td>{unit.roomNumber}</td>
                  <td>{guests(unit)}</td>
                  <td>
                    <FundEditor categories={editorCategories} room={unit} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </div>
  );
}
