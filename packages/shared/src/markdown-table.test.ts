import { describe, expect, it } from 'vitest';
import { findMarkdownTable } from './markdown-table';

const md = `
# Doc

## Первая

| A | B |
|---|---|
| 1 | **x** |

текст между таблицами

## Вторая

| C |
|---|
| только одна колонка |
`;

describe('findMarkdownTable', () => {
  it('finds the table under a heading and strips bold markup', () => {
    const t = findMarkdownTable(md, /^## Первая/m);
    expect(t?.headers).toEqual(['A', 'B']);
    expect(t?.rows).toEqual([{ A: '1', B: 'x' }]);
  });
  it('returns the second table by its own heading', () => {
    const t = findMarkdownTable(md, /^## Вторая/m);
    expect(t?.rows).toEqual([{ C: 'только одна колонка' }]);
  });
  it('returns undefined when the heading is absent', () => {
    expect(findMarkdownTable(md, /^## Нет такой/m)).toBeUndefined();
  });
});
