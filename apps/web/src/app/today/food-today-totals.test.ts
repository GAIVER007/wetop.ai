import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FoodTodayTotals } from './food-today-totals';

/** /today/operations ресторана (аудит ресторана 22.10.2026): ряд из 5 плиток заменён одной строкой итогов */
describe('итоги дня ресторана одной строкой', () => {
  const html = renderToStaticMarkup(
    createElement(FoodTodayTotals, {
      planned: 4,
      expectedGuests: 11,
      seatedGuests: 3,
      freeTables: 2,
      tablesTotal: 5,
      revenueMinor: '78000',
      currency: 'KZT',
      revenueDeltaPct: 12,
    }),
  );
  it('строка money-summary без плиток, числа в прежних testid', () => {
    expect(html).toContain('class="money-summary');
    expect(html).not.toContain('class="stat');
    expect(html).toMatch(/data-testid="today-planned"[^>]*>4</);
    expect(html).toMatch(/data-testid="today-expected-guests"[^>]*>11</);
    expect(html).toMatch(/data-testid="today-seated-guests"[^>]*>3</);
    expect(html).toMatch(/data-testid="today-tables"[^>]*>2</);
    expect(html).toContain('из 5');
    expect(html).toMatch(/data-testid="today-revenue"[^>]*>780 ₸/);
    expect(html).toContain('+12 % к вчера');
  });
  it('столы не настроены: так и написано вместо «из 0»', () => {
    const empty = renderToStaticMarkup(
      createElement(FoodTodayTotals, {
        planned: 0, expectedGuests: 0, seatedGuests: 0, freeTables: 0, tablesTotal: 0,
        revenueMinor: '0', currency: 'KZT', revenueDeltaPct: null,
      }),
    );
    expect(empty).toContain('столы не настроены');
    expect(empty).not.toContain('к вчера');
  });
  it('экран дня больше не строит плитки Stat', () => {
    const source = readFileSync(new URL('./food-today.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/<Stats?\b/);
    expect(source).toContain('<FoodTodayTotals');
  });
});
