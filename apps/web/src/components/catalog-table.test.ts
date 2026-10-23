import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CatalogGroupRow, groupCatalog } from './catalog-table';

/** Каталог A + подзаголовки B (решение владельца 23.10.2026, п. 6) */
const cats = [
  { id: 'b', name: 'Завтраки' },
  { id: 'h', name: 'Горячее' },
  { id: 'e', name: 'Пустая' },
];
const rows = [
  { id: 1, c: 'h' },
  { id: 2, c: 'b' },
  { id: 3, c: null },
  { id: 4, c: 'h' },
  { id: 5, c: 'gone' },
];

describe('groupCatalog', () => {
  it('группы в порядке справочника, строки внутри в исходном порядке', () => {
    const g = groupCatalog(rows, (r) => r.c, cats);
    expect(g.map((x) => x.name)).toEqual(['Завтраки', 'Горячее', 'Без категории']);
    expect(g[1]!.rows.map((r) => r.id)).toEqual([1, 4]);
  });
  it('пустая категория без подзаголовка; неизвестная и пустая категория строки — в «Без категории» последней', () => {
    const g = groupCatalog(rows, (r) => r.c, cats);
    expect(g.find((x) => x.key === 'e')).toBeUndefined();
    expect(g.at(-1)).toMatchObject({ key: '', name: 'Без категории' });
    expect(g.at(-1)!.rows.map((r) => r.id)).toEqual([3, 5]);
  });
  it('ни одна строка не теряется и не дублируется', () => {
    const g = groupCatalog(rows, (r) => r.c, cats);
    expect(g.flatMap((x) => x.rows).map((r) => r.id).sort()).toEqual([1, 2, 3, 4, 5]);
  });
  it('подзаголовок: строка таблицы на все колонки с числом позиций', () => {
    const html = renderToStaticMarkup(
      createElement('table', null, createElement('tbody', null, createElement(CatalogGroupRow, { name: 'Горячее', count: 2, columns: 7 }))),
    );
    expect(html).toContain('<tr class="catalog-group"><th scope="colgroup" colSpan="7">Горячее <span class="catalog-group__count">2</span></th></tr>');
  });
});
