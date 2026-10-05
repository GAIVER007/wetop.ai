'use client';
import { useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { InventoryCategory, InventoryUnit } from '../../lib/api';
import { Badge, EmptyState, Input, Table } from '../../components/ui';
import { ActionMenu, type ActionMenuItem } from '../../components/action-menu';
import { Icon } from '../../components/icon';
import { FundEditor, FundEditorDialog } from './fund-editor';
import { CategoryPreview } from './category-preview';
import { CategoryRatePlanDialog } from './rate-plan-choice';
import { pluralRu } from '../../lib/plural';
import { KIND_WORD, addWord, capacityShort, compositionHref, unitWord } from './category-words';

const KIND_FILTERS: [InventoryCategory['kind'], string][] = [
  ['PRIVATE_ROOM', 'Номера'],
  ['DORM_BED', 'Койко-места'],
  ['APARTMENT', 'Апартаменты'],
];

/** Щелчок по строке или карточке открывает панель, если он не пришёлся на ссылку, кнопку или меню */
const onSurface = (e: MouseEvent, open: () => void) => {
  if ((e.target as HTMLElement).closest('a, button, [role="menu"]')) return;
  open();
};

/**
 * Категории (ТЗ «Категории v2», ADR-109): C1 — таблица, одна строка на категорию, действия в меню
 * строки; C2 — панель категории по щелчку и режим «Карточки». Состав не разворачивается на месте —
 * число единиц ведёт в «Номера и койки».
 */
export function CategoryCatalog({
  categories,
  units,
}: {
  categories: InventoryCategory[];
  units: InventoryUnit[];
}) {
  const search = useSearchParams();
  const view = search.get('view') === 'cards' ? 'cards' : 'list';
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'' | InventoryCategory['kind']>('');
  const [preview, setPreview] = useState<InventoryCategory | null>(null);
  const [editing, setEditing] = useState<InventoryCategory | null>(null);
  const [adding, setAdding] = useState<InventoryCategory | null>(null);
  const [rating, setRating] = useState<InventoryCategory | null>(null);
  const query = q.trim().toLocaleLowerCase('ru');
  const filtered = categories.filter(
    (c) => (!kind || c.kind === kind) && c.name.toLocaleLowerCase('ru').includes(query),
  );
  const memberCount = (c: InventoryCategory) =>
    units.filter((u) => u.accommodationTypeCode === c.code).length;
  const setView = (next: 'list' | 'cards') =>
    window.history.replaceState(
      null,
      '',
      next === 'cards' ? '/rooms/categories?view=cards' : '/rooms/categories',
    );
  const menu = (c: InventoryCategory): ActionMenuItem[] => [
    { label: 'Открыть', onSelect: () => setPreview(c) },
    { label: 'Редактировать', onSelect: () => setEditing(c) },
    { label: addWord(c), onSelect: () => setAdding(c) },
    c.ratePlans
      ? { label: 'Настроить тарифы', href: `/rates?category=${encodeURIComponent(c.code)}` }
      : { label: 'Настроить тариф', onSelect: () => setRating(c) },
    { label: 'Показать в календаре', href: `/chessboard?category=${encodeURIComponent(c.code)}` },
    { label: 'Свободные места', href: `/rooms/availability?category=${encodeURIComponent(c.code)}` },
  ];
  const fund = (c: InventoryCategory) => {
    const count = memberCount(c);
    return count ? (
      <Link href={compositionHref(c)} prefetch={false}>
        {unitWord(c.kind, count)}
      </Link>
    ) : (
      <Badge tone="warn">не добавлен</Badge>
    );
  };
  const rates = (c: InventoryCategory) =>
    c.ratePlans ? (
      <Link href={`/rates?category=${encodeURIComponent(c.code)}`} prefetch={false}>
        {pluralRu(c.ratePlans, ['тариф', 'тарифа', 'тарифов'])}
      </Link>
    ) : (
      <Badge tone="warn">тариф не настроен</Badge>
    );
  /** Без мест или без тарифа категорию не продать — так и говорим (ADR-119).
      Обычное состояние — текстом, бейджи только у исключений (упрощение 02.10, как в фонде) */
  const status = (c: InventoryCategory) =>
    !c.active ? (
      <Badge tone="neutral">В архиве</Badge>
    ) : memberCount(c) && c.ratePlans ? (
      <span className="muted">активна</span>
    ) : (
      <Badge tone="warn">Не готова к продаже</Badge>
    );
  const open = (c: InventoryCategory) => (
    <button type="button" className="fund-cat-open" onClick={() => setPreview(c)}>
      {c.name}
    </button>
  );
  const kindCell = (c: InventoryCategory) => (
    <>
      <Icon name={c.kind === 'DORM_BED' ? 'bed' : 'inventory'} width={16} height={16} />
      {KIND_WORD[c.kind]}
    </>
  );
  if (!categories.length)
    return (
      <section className="fund-empty">
        <h2>Начните с категории размещения</h2>
        <p>
          Например, «Двухместный номер» или «Койка в общей комнате». Затем добавьте конкретные
          номера и койки.
        </p>
        <FundEditor categories={categories} mode="category" />
      </section>
    );
  return (
    <>
      <div className="fund-toolbar">
        <Input
          type="search"
          aria-label="Поиск категории"
          placeholder="Найти категорию"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="chips" role="group" aria-label="Тип размещения">
          <button type="button" aria-pressed={!kind} onClick={() => setKind('')}>
            Все <span className="chips__count">{categories.length}</span>
          </button>
          {KIND_FILTERS.filter(([value]) => categories.some((c) => c.kind === value)).map(
            ([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={kind === value}
                onClick={() => setKind(kind === value ? '' : value)}
              >
                {label}{' '}
                <span className="chips__count">
                  {categories.filter((c) => c.kind === value).length}
                </span>
              </button>
            ),
          )}
        </div>
        {(query || kind) && (
          <span className="muted" role="status">
            Показано {filtered.length} из {categories.length}
          </span>
        )}
        <div className="chips fund-view" role="group" aria-label="Вид списка категорий">
          <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>
            <Icon name="menu" width={16} height={16} />
            Список
          </button>
          <button type="button" aria-pressed={view === 'cards'} onClick={() => setView('cards')}>
            <Icon name="today" width={16} height={16} />
            Карточки
          </button>
        </div>
      </div>
      {!filtered.length ? (
        <EmptyState icon={<Icon name="inventory" />} title="Категории не найдены">
          Измените поиск или сбросьте фильтр типа.
        </EmptyState>
      ) : view === 'cards' ? (
        <ul className="fund-cat-cards" aria-label="Категории размещения">
          {filtered.map((c) => (
            <li
              key={c.code}
              className="fund-cat-card"
              data-testid="fund-category-card"
              onClick={(e) => onSurface(e, () => setPreview(c))}
            >
              <div className="fund-cat-card-top">
                {open(c)}
                <ActionMenu size="sm" label={`Действия с категорией ${c.name}`} items={menu(c)} />
              </div>
              <span className="fund-cat-kind">{kindCell(c)}</span>
              <div className="fund-cat-card-facts">
                {fund(c)}
                <span>{capacityShort(c)}</span>
              </div>
              <div className="fund-cat-card-facts">
                <span>Тарифы: {rates(c)}</span>
                {status(c)}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Table className="fund-cat-table" aria-label="Категории размещения">
          <thead>
            <tr>
              <th>Категория</th>
              <th>Фонд</th>
              <th>Вместимость</th>
              <th>Тарифы</th>
              <th>Статус</th>
              <th>
                <span className="sr-only">Действия</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.code}
                data-testid="fund-category-row"
                onClick={(e) => onSurface(e, () => setPreview(c))}
              >
                {/* Тип продажи — значком у названия и словом фонда («36 коек»), не отдельной колонкой */}
                <td className="fund-cat-name">
                  <Icon name={c.kind === 'DORM_BED' ? 'bed' : 'inventory'} width={16} height={16} />
                  <span className="sr-only">{KIND_WORD[c.kind]}</span>
                  {open(c)}
                </td>
                <td className="fund-cat-units">{fund(c)}</td>
                <td className="fund-cat-capacity">{capacityShort(c)}</td>
                <td className="fund-cat-rates">{rates(c)}</td>
                <td className="fund-cat-status">{status(c)}</td>
                <td className="fund-cat-actions">
                  <ActionMenu
                    size="sm"
                    label={`Действия с категорией ${c.name}`}
                    items={menu(c)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {preview && (
        <CategoryPreview
          key={`preview-${preview.code}`}
          category={preview}
          units={units}
          onClose={() => setPreview(null)}
          onEdit={() => {
            setPreview(null);
            setEditing(preview);
          }}
          onAdd={() => {
            setPreview(null);
            setAdding(preview);
          }}
          onSetRate={() => {
            setPreview(null);
            setRating(preview);
          }}
        />
      )}
      {editing && (
        <FundEditorDialog
          key={`edit-${editing.code}`}
          categories={categories}
          mode="category"
          category={editing}
          unitCount={memberCount(editing)}
          open
          onClose={() => setEditing(null)}
        />
      )}
      {adding && (
        <FundEditorDialog
          key={`add-${adding.code}`}
          categories={categories}
          category={adding}
          open
          onClose={() => setAdding(null)}
        />
      )}
      {rating && (
        <CategoryRatePlanDialog
          key={`rate-${rating.code}`}
          category={rating}
          onClose={() => setRating(null)}
        />
      )}
    </>
  );
}
