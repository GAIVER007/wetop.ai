import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FoodPeriodPanel } from './food-period';
import type { FoodPeriodReport } from '../../../../lib/food-types';

/** Аналитика ресторана без плиток (аудит ресторана 22.10.2026): итоги периода одной строкой, testid прежние */
describe('продажи ресторана за период', () => {
  const report = {
    from: '2026-10-01',
    to: '2026-10-22',
    currency: 'KZT',
    revenueMinor: '560000',
    guestsCount: 4,
    barRevenueMinor: '0',
    averageCheckMinor: '560000',
    ordersCount: 1,
    costMinor: '0',
    grossProfitMinor: '560000',
    foodCostPct: null,
    payments: [],
    topDishes: [],
    shortages: [],
    waiters: [],
  } as unknown as FoodPeriodReport;
  const html = renderToStaticMarkup(FoodPeriodPanel({ report }));
  it('итоги строкой money-summary, без Stat', () => {
    expect(html).toContain('class="money-summary');
    expect(html).not.toContain('class="stat');
    expect(html).toMatch(/data-testid="food-period-revenue"[^>]*>5 600 ₸/);
    expect(html).toMatch(/data-testid="food-period-guests"[^>]*>4</);
    expect(html).toMatch(/data-testid="food-period-bar-revenue"[^>]*>0 ₸/);
    expect(html).toMatch(/data-testid="food-period-check"[^>]*>5 600 ₸/);
    expect(html).toMatch(/data-testid="food-period-orders"[^>]*>1</);
  });
  it('экран аналитики без фразы разработчика и со словом «Брони» у ресторана', () => {
    const screen = readFileSync(new URL('./screen.tsx', import.meta.url), 'utf8');
    expect(screen).not.toContain('пока не рассчитываются');
    expect(screen).toContain("'Брони по статусам'");
  });
});
