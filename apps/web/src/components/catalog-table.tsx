import type { ReactNode } from 'react';
import { msg } from '../i18n';
import { T } from '../i18n/locale-provider';

/**
 * Каталог по варианту A с подзаголовками категорий из B (решение владельца 23.10.2026,
 * docs/decisions/2026-10-23-vertical-unification-owner-yes.md п. 6; эскиз sketches/catalog).
 * Одна таблица у гостиницы, салона и ресторана: «Название, Категория, {свой параметр}, Цена, Себестоимость,
 * Статус»; при «Все категории» строки разбиты подзаголовками категорий. Здесь только порядок и подзаголовок,
 * данные и запись остаются у каждого направления.
 */
export type CatalogGroup<T> = { key: string; name: string; rows: T[] };

/**
 * Группы в порядке справочника категорий; строки без известной категории — последней группой «Без категории».
 * Пустые категории не показываются: подзаголовок без строк только занимает высоту экрана.
 */
export function groupCatalog<T>(
  rows: readonly T[],
  categoryOf: (row: T) => string | null | undefined,
  categories: readonly { id: string; name: string }[],
  noneLabel: string = msg('Без категории'),
): CatalogGroup<T>[] {
  const known = new Map(categories.map((c) => [c.id, c.name]));
  const byKey = new Map<string, T[]>();
  for (const row of rows) {
    const id = categoryOf(row);
    const key = id && known.has(id) ? id : '';
    const list = byKey.get(key);
    if (list) list.push(row);
    else byKey.set(key, [row]);
  }
  const groups: CatalogGroup<T>[] = [];
  for (const c of categories) {
    const list = byKey.get(c.id);
    if (list?.length) groups.push({ key: c.id, name: c.name, rows: list });
  }
  const none = byKey.get('');
  if (none?.length) groups.push({ key: '', name: noneLabel, rows: none });
  return groups;
}

/** Подзаголовок категории внутри `<tbody>`: строка на всю ширину таблицы, название и число позиций. */
export function CatalogGroupRow({ name, count, columns }: { name: ReactNode; count: number; columns: number }) {
  return (
    <tr className="catalog-group">
      <th scope="colgroup" colSpan={columns}>
        {typeof name === 'string' ? <T text={name} /> : name} <span className="catalog-group__count">{count}</span>
      </th>
    </tr>
  );
}
