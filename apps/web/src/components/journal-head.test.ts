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
      [/<DayNav/, /summary=\{\s*<(SummaryLine|p className="summary-line")/, /<JournalSearch/, /<EmployeeFilter/, /<JournalFilter[^>]*?label=(?:"Услуга"|\{t\('Услуга'\)\})/s, /<JournalFilter[^>]*?label=(?:"Статус записи"|\{t\('Статус записи'\)\})/s, /views=\{views\}/],
    ],
    [
      'салон, неделя',
      'app/beauty/week-calendar.tsx',
      [/<DateRangePopover|<WeekNav/, /summary=\{\s*<(SummaryLine|p className="summary-line")/, /<JournalSearch/, /<EmployeeFilter/, /<JournalFilter[^>]*?label=(?:"Услуга"|\{t\('Услуга'\)\})/s, /<JournalFilter[^>]*?label=(?:"Статус записи"|\{t\('Статус записи'\)\})/s, /views=\{views\}/],
    ],
    [
      'ресторан, план и расписание',
      'app/food/workspace-board.tsx',
      [/<DayNav/, /summary=\{\s*<SummaryLine/, /<JournalSearch/, /<JournalFilter[^>]*?label=(?:"Зона"|\{t\('Зона'\)\})/s, /<JournalFilter[^>]*?label=(?:"Статус брони"|\{t\('Статус брони'\)\})/s, /views=\{/],
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
    // подпись по-русски или через перевод: aria-label="X" либо aria-label={t('X')}
    const at = (s: string) => {
      const plain = grid.indexOf(s);
      if (plain >= 0) return plain;
      const m = /^aria-label="(.*)"$/.exec(s);
      return m ? grid.indexOf(`aria-label={t('${m[1]}')}`) : -1;
    };
    expect(at('aria-label="Поиск в календаре"')).toBeGreaterThan(0);
    expect(at('aria-label="Поиск в календаре"')).toBeLessThan(at('aria-label="Категория"'));
    expect(at('aria-label="Категория"')).toBeLessThan(at('aria-label="Статус места"'));
    expect(at('aria-label="Статус места"')).toBeLessThan(at('board-filters-open'));
  });
});

/**
 * Журнал на ПК в один экран (ТЗ 25.10.2026, п. 9): страница не прокручивается, шапка видна целиком, сетка занимает
 * остаток высоты и прокручивается внутри себя, панель дня справа тоже. Общий слой `.journal-screen` в
 * `journal-head.css` только для ширины ПК; телефон и планшет листают страницу как раньше.
 */
describe('журнал в один экран на ПК: общий слой', () => {
  it('общий класс в CSS шапки: колонка во весь экран под верхней панелью, сетка тянется и листается внутри', () => {
    const css = source('app/journal-head.css');
    const desk = css.slice(css.indexOf('@media (min-width: 961px) {\n    div.workspace .page.journal-screen'));
    expect(desk.length).toBeLessThan(css.length);
    expect(desk).toContain('height: calc(100dvh - var(--header-h))');
    expect(desk).toMatch(/\.page\.journal-screen > \.journal-screen__board \{[^}]*flex: 1 1 0;[^}]*min-height: 0;/);
  });
  it('салон: день журнала собран слоем одного экрана, сетка и панель дня листаются внутри', () => {
    expect(source('app/beauty/page.tsx')).toContain('journal-screen');
    expect(source('app/beauty/journal.tsx')).toContain('beauty-layout journal-screen__board');
    const css = source('app/beauty/day-panel.css');
    expect(css).toMatch(/\.journal-screen \.beauty-day-panel \{[^}]*overflow-y: auto;/);
  });
  it('ресторан: журнал и расписание собраны слоем одного экрана, план зала и шкала листаются внутри', () => {
    const screen = source('app/food/screen.tsx');
    expect(screen).toContain("'journal-page journal-screen'");
    expect(screen).toContain('<div key={data.scopeKey} className={kind === \'catalog\' ? undefined : \'journal-screen__pass\'}>');
    const board = source('app/food/workspace-board.tsx');
    expect(board).toContain('food-workspace rest-ws journal-screen__pass');
    expect(board).toContain('rest-fp journal-screen__board');
    expect(board).toContain('<div className="journal-screen__board">');
    const css = source('app/journal-head.css');
    const desk = css.slice(css.indexOf('@media (min-width: 961px) {\n    div.workspace .page.journal-screen'));
    expect(desk).toMatch(/\.page\.journal-screen \.journal-screen__pass \{[^}]*flex: 1 1 0;[^}]*min-height: 0;/);
    expect(desk).toMatch(/\.journal-screen__pass > \.journal-screen__board \{[^}]*overflow: auto;/);
    // вложенная обёртка (срез `scopeKey` > колонка экрана) тянется на остаток, а не по содержимому: иначе доска
    // с основой 0 сжимается в ноль, брони без стола вылезают поверх и клики ловит обёртка (гейт PR #867)
    const nested = desk.indexOf('.journal-screen__pass > .journal-screen__pass {');
    expect(nested).toBeGreaterThan(desk.indexOf('.journal-screen__pass > * {'));
    expect(desk.slice(nested)).toMatch(/^[^}]*flex: 1 1 0;[^}]*min-height: 0;/);
  });
});
