'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { InventoryCategory, InventoryUnit } from '../../lib/api';
import { Badge, EmptyState, Input, Table } from '../../components/ui';
import { ActionMenu } from '../../components/action-menu';
import { Icon } from '../../components/icon';
import { FundEditor } from './fund-editor';
import { pluralRu } from '../../lib/plural';

const KIND_WORD: Record<InventoryCategory['kind'], string> = {
  PRIVATE_ROOM: 'Номер целиком',
  DORM_BED: 'Койко-место',
  APARTMENT: 'Апартаменты',
};
const KIND_FILTERS: [InventoryCategory['kind'], string][] = [
  ['PRIVATE_ROOM', 'Номера'],
  ['DORM_BED', 'Койко-места'],
  ['APARTMENT', 'Апартаменты'],
];
const unitWord = (kind: InventoryCategory['kind'], n: number) =>
  pluralRu(n, kind === 'DORM_BED' ? ['койка', 'койки', 'коек'] : ['номер', 'номера', 'номеров']);

/**
 * Таблица категорий (ТЗ «Категории v2» C1, ADR-106): одна строка на категорию, действия — в меню
 * строки, состав не разворачивается на месте — число единиц ведёт в «Номера и койки».
 */
export function CategoryCatalog({
  categories,
  units,
}: {
  categories: InventoryCategory[];
  units: InventoryUnit[];
}) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'' | InventoryCategory['kind']>('');
  const [editing, setEditing] = useState<InventoryCategory | null>(null);
  const [adding, setAdding] = useState<InventoryCategory | null>(null);
  const query = q.trim().toLocaleLowerCase('ru');
  const filtered = categories.filter(
    (c) => (!kind || c.kind === kind) && c.name.toLocaleLowerCase('ru').includes(query),
  );
  const memberCount = (c: InventoryCategory) =>
    units.filter((u) => u.accommodationTypeCode === c.code).length;
  const composition = (c: InventoryCategory) => `/inventory?category=${encodeURIComponent(c.code)}`;
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
      </div>
      {!filtered.length ? (
        <EmptyState icon={<Icon name="inventory" />} title="Категории не найдены">
          Измените поиск или сбросьте фильтр типа.
        </EmptyState>
      ) : (
        <Table className="fund-cat-table" aria-label="Категории размещения">
          <thead>
            <tr>
              <th>Категория</th>
              <th>Тип продажи</th>
              <th>Фонд</th>
              <th>Вместимость</th>
              <th>Тарифы</th>
              <th>Статус</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const count = memberCount(c);
              return (
                <tr key={c.code} data-testid="fund-category-row">
                  <td className="fund-cat-name">
                    <Link href={composition(c)} prefetch={false}>
                      {c.name}
                    </Link>
                  </td>
                  <td className="fund-cat-kind">
                    <Icon name={c.kind === 'DORM_BED' ? 'bed' : 'inventory'} width={16} height={16} />
                    {KIND_WORD[c.kind]}
                  </td>
                  <td className="fund-cat-units">
                    {count ? (
                      <Link href={composition(c)} prefetch={false}>
                        {unitWord(c.kind, count)}
                      </Link>
                    ) : (
                      <Badge tone="warn">не добавлен</Badge>
                    )}
                  </td>
                  <td className="fund-cat-capacity">
                    {c.kind === 'DORM_BED'
                      ? '1 гость / койка'
                      : pluralRu(c.capacityAdults, ['гость', 'гостя', 'гостей'])}
                  </td>
                  <td className="fund-cat-rates">
                    {c.ratePlans ? (
                      <Link href={`/rates?category=${encodeURIComponent(c.code)}`} prefetch={false}>
                        {pluralRu(c.ratePlans, ['тариф', 'тарифа', 'тарифов'])}
                      </Link>
                    ) : (
                      <Badge tone="warn">нет тарифа</Badge>
                    )}
                  </td>
                  <td className="fund-cat-status">
                    <Badge tone={c.active ? 'ok' : 'neutral'}>
                      {c.active ? 'Активна' : 'В архиве'}
                    </Badge>
                  </td>
                  <td className="fund-cat-actions">
                    <ActionMenu
                      size="sm"
                      label={`Действия с категорией ${c.name}`}
                      items={[
                        { label: 'Открыть состав', href: composition(c) },
                        { label: 'Редактировать', onSelect: () => setEditing(c) },
                        {
                          label:
                            c.kind === 'DORM_BED' ? 'Добавить комнату с койками' : 'Добавить номер',
                          onSelect: () => setAdding(c),
                        },
                        {
                          label: 'Настроить тарифы',
                          href: `/rates?category=${encodeURIComponent(c.code)}`,
                        },
                        {
                          label: 'Показать на шахматке',
                          href: `/chessboard?category=${encodeURIComponent(c.code)}`,
                        },
                        { label: 'Доступность', href: '/rooms/availability' },
                      ]}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      {editing && (
        <FundEditor
          key={`edit-${editing.code}`}
          categories={categories}
          mode="category"
          category={editing}
          control={{ onClose: () => setEditing(null) }}
        />
      )}
      {adding && (
        <FundEditor
          key={`add-${adding.code}`}
          categories={categories}
          category={adding}
          control={{ onClose: () => setAdding(null) }}
        />
      )}
    </>
  );
}
