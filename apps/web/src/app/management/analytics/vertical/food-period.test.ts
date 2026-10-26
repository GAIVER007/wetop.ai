import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FoodPeriodPanel } from './food-period';
import type { FoodPeriodReport } from '../../../../lib/food-types';

/**
 * Аналитика ресторана: с 25.10.2026 пульт владельца (вариант A, решение владельца) с четырьмя плитками вместо строки
 * итогов (правило 22.10.2026 заменено этим решением). testid прежних цифр сохранены.
 */
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
  it('четыре плитки пульта, без прежних Stat', () => {
    expect(html.match(/class="kpi kpi--/g)).toHaveLength(4);
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

/** Ресторан, как салон (владелец 26.10.2026): у официантов в аналитике ЗП за месяц из «Зарплаты» */
describe('официанты с ЗП', () => {
  const report = {
    from: '2026-10-01', to: '2026-10-26', currency: 'KZT', revenueMinor: '560000', guestsCount: 4, barRevenueMinor: '0',
    averageCheckMinor: '560000', ordersCount: 1, costMinor: '0', grossProfitMinor: '560000', foodCostPct: null,
    payments: [], topDishes: [], shortages: [],
    waiters: [{ waiterId: 'w1', name: 'Айдар', orders: 3, revenueMinor: '560000' }],
  } as unknown as FoodPeriodReport;
  it('колонка ЗП: начислено за месяц или прочерк', () => {
    const html = renderToStaticMarkup(FoodPeriodPanel({ report, pay: new Map([['w1', '12000000']]) }));
    expect(html).toContain('>ЗП<');
    expect(html).toContain('120 000 ₸');
    const bare = renderToStaticMarkup(FoodPeriodPanel({ report }));
    expect(bare).toContain('>ЗП<');
    expect(bare).toMatch(/Айдар.*—/);
  });
});
