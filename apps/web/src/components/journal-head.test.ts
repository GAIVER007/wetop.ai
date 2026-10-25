import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: Record<string, unknown>) => createElement('a', { href, ...rest }, children as never),
}));

import { JournalFilter, JournalHead, JournalSearch } from './journal-head';

const web = join(__dirname, '..');
const source = (rel: string) => readFileSync(join(web, rel), 'utf8');
const text = (html: string) => html.replace(/<[^>]+>/g, '');

/**
 * Шапка журнала одна во всех направлениях (владелец 24.10.2026: «везде единая, удобная, с выбором даты, специалиста,
 * услуг»). Образец: календарь гостиницы. Порядок в строке отборов один: поиск, выборы (кто, что, статус), «Фильтры»,
 * вид справа. Решение: docs/decisions/2026-10-24-journal-head-filters.md.
 */
describe('единая шапка журнала: части и порядок', () => {
  it('поиск: поле поиска страницы (Ctrl+K), подпись для читалки, значок', () => {
    const html = renderToStaticMarkup(
      createElement(JournalSearch, { value: '', onChange: () => undefined, label: 'Поиск в журнале', placeholder: 'Клиент, телефон' }),
    );
    expect(html).toContain('type="search"');
    expect(html).toContain('aria-label="Поиск в журнале"');
    expect(html).toContain('data-page-search=""');
    expect(html).toContain('placeholder="Клиент, телефон"');
    expect(html).toContain('journal-search');
  });

  it('выбор: «Все …» первым, подпись для читалки, выбранное значение', () => {
    const html = renderToStaticMarkup(
      createElement(JournalFilter, {
        label: 'Услуга',
        allLabel: 'Все услуги',
        value: 's2',
        onChange: () => undefined,
        options: [
          { value: 's1', label: 'Маникюр' },
          { value: 's2', label: 'Стрижка' },
        ],
      }),
    );
    expect(html).toContain('aria-label="Услуга"');
    expect(html).toMatch(/<option value="">Все услуги<\/option><option value="s1">Маникюр/);
    expect(html).toContain('<option value="s2" selected="">Стрижка</option>');
    expect(html).toContain('journal-filter');
  });

  it('карточка отборов: вид всегда последним и прижат вправо', () => {
    const html = renderToStaticMarkup(
      createElement(JournalHead, {
        title: 'Журнал',
        filters: createElement('span', null, 'Поиск'),
        views: createElement('span', null, 'День Неделя'),
      }),
    );
    expect(text(html)).toMatch(/Поиск.*День Неделя/);
    expect(html).toContain('journal-head__views');
  });

  // каждый журнал собирает шапку из одних частей: период/день, итоги строкой, поиск, выборы, вид
  const journals: Array<[string, string, RegExp[]]> = [
    [
      'салон, день',
      'app/beauty/journal.tsx',
      [/<DayNav/, /summary=\{\s*<(SummaryLine|p className="summary-line")/, /<JournalSearch/, /<EmployeeFilter/, /<JournalFilter[^>]*?label="Услуга"/s, /<JournalFilter[^>]*?label="Статус записи"/s, /views=\{views\}/],
    ],
    [
      'салон, неделя',
      'app/beauty/week-calendar.tsx',
      [/<DateRangePopover|<WeekNav/, /summary=\{\s*<(SummaryLine|p className="summary-line")/, /<JournalSearch/, /<EmployeeFilter/, /<JournalFilter[^>]*?label="Услуга"/s, /<JournalFilter[^>]*?label="Статус записи"/s, /views=\{views\}/],
    ],
    [
      'ресторан, план и расписание',
      'app/food/workspace-board.tsx',
      [/<DayNav/, /summary=\{\s*<SummaryLine/, /<JournalSearch/, /<JournalFilter[^>]*?label="Зона"/s, /<JournalFilter[^>]*?label="Статус брони"/s, /views=\{/],
    ],
  ];
  for (const [name, rel, parts] of journals) {
    it(`${name}: день или период, итоги строкой, поиск, выборы, вид`, () => {
      const file = source(rel);
      for (const part of parts) expect(file, `${rel}: ${part}`).toMatch(part);
      // порядок отборов как у гостиницы: внутри `filters={…}` поиск раньше выборов
      const block = file.slice(file.indexOf('filters={'));
      const search = block.indexOf('<JournalSearch');
      const firstSelect = Math.min(
        ...['<JournalFilter', '<EmployeeFilter', 'serviceFilter', 'statusFilter']
          .map((tag) => block.indexOf(tag))
          .filter((i) => i > 0),
      );
      expect(search, `${rel}: поиск первым в строке отборов`).toBeLessThan(firstSelect);
    });
  }

  it('гостиница остаётся образцом: поиск, категория, статус, «Фильтры» в этом порядке', () => {
    const grid = source('app/chessboard/board-grid.tsx');
    const at = (s: string) => grid.indexOf(s);
    expect(at('aria-label="Поиск в календаре"')).toBeGreaterThan(0);
    expect(at('aria-label="Поиск в календаре"')).toBeLessThan(at('aria-label="Категория"'));
    expect(at('aria-label="Категория"')).toBeLessThan(at('aria-label="Статус места"'));
    expect(at('aria-label="Статус места"')).toBeLessThan(at('board-filters-open'));
  });
});
