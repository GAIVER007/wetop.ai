import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BeautyPultView } from './beauty-pult';
import { FoodPeriodPanel } from './food-period';
import { beautyPult } from './pult';
import { BEAUTY_LABELS, FOOD_LABELS } from './metrics';
import type { BeautyDay } from '../../../../lib/api';
import type { FoodPeriodReport } from '../../../../lib/food-types';

/** Пульт владельца (вариант A, 25.10.2026) на экране: плитки, подсказки, разборы и прежние testid для проверок UI */
const day: BeautyDay = {
  location: { id: 'l', name: 'Салон', timezone: 'Asia/Almaty', currency: 'KZT' },
  date: '2026-10-20',
  columns: [
    {
      id: 'm1',
      name: 'Айгерим',
      intervals: [{ timeFrom: '10:00', timeTo: '18:00' }],
      timeOff: false,
      timeOffReason: null,
      serviceIds: [],
    },
  ],
  appointments: [
    {
      id: 'a1',
      employeeId: 'm1',
      serviceId: 's',
      serviceName: 'Стрижка',
      customer: { id: 'c1', name: 'Клиент', phone: null },
      startsAt: '2026-10-20T05:00:00Z',
      endsAt: '2026-10-20T06:00:00Z',
      startMinutes: 600,
      endMinutes: 660,
      status: 'DONE',
      next: [],
      priceMinor: '1200000',
      paidMinor: '1200000',
      refundedMinor: '0',
      currency: 'KZT',
      notes: null,
      payments: [
        {
          id: 'p',
          kind: 'INCOME',
          method: 'CASH',
          amountMinor: '1200000',
          at: '2026-10-20T06:00:00Z',
        },
      ],
    },
  ],
  services: [],
  bounds: { fromMinutes: 600, toMinutes: 1080 },
};

describe('пульт салона на экране', () => {
  const html = renderToStaticMarkup(
    BeautyPultView({
      p: beautyPult([day], 'KZT'),
      prev: null,
      labels: BEAUTY_LABELS,
      today: '2026-10-20',
    }),
  );
  it('четыре плитки: выручка, средний чек, загрузка мастеров, повторные клиенты', () => {
    for (const id of ['revenue', 'average', 'load', 'repeat'])
      expect(html).toContain(`data-testid="pa-kpi-${id}"`);
    expect(html).toMatch(/data-testid="pa-kpi-revenue"[^>]*>12 000 ₸/);
  });
  it('прежние testid проверок UI на месте: выручка в валюте и статусы', () => {
    expect(html).toMatch(/data-testid="revenue-KZT"[^>]*>12\s000,00 KZT/);
    expect(html).toMatch(/data-testid="period-DONE"[^>]*>1</);
  });
  it('подсказки, мастера, услуги и оплаты', () => {
    expect(html).toContain('data-testid="pult-insights"');
    expect(html).toContain('Что сделать сейчас');
    expect(html).toContain('data-testid="master-m1"');
    expect(html).toContain('Стрижка, 1');
    expect(html).toContain('Наличные');
  });
  it('без прошлого периода сравнение не рисуется', () => {
    expect(html).not.toContain('kpi-delta');
  });
  it('пустой период: нули по статусам доступны, текст вместо графика', () => {
    const empty = renderToStaticMarkup(
      BeautyPultView({
        p: beautyPult([{ ...day, appointments: [] }], 'KZT'),
        prev: null,
        labels: BEAUTY_LABELS,
        today: '2026-10-20',
      }),
    );
    expect(empty).toMatch(/data-testid="period-DONE"[^>]*>0</);
    expect(empty).toContain('Завершённых визитов за период нет.');
    expect(empty).toContain('data-testid="insight-calm"');
  });
});

describe('пульт ресторана на экране', () => {
  const report = {
    from: '2026-10-20',
    to: '2026-10-20',
    currency: 'KZT',
    ordersCount: 2,
    guestsCount: 5,
    revenueMinor: '266000',
    barRevenueMinor: '0',
    averageCheckMinor: '133000',
    payments: [{ method: 'KASPI', amountMinor: '266000', count: 2 }],
    topDishes: [{ name: 'Паста', qty: 3, revenueMinor: '117000' }],
    waiters: [],
    costMinor: '0',
    grossProfitMinor: '266000',
    foodCostPct: 0,
    shortages: [],
    revenueByDay: [{ date: '2026-10-20', revenueMinor: '266000', orders: 2 }],
    categories: [],
  } as FoodPeriodReport;
  const prev = { ...report, revenueMinor: '133000', ordersCount: 1 };
  const html = renderToStaticMarkup(
    FoodPeriodPanel({
      report,
      previous: prev,
      counts: { BOOKED: 1, NO_SHOW: 0 },
      labels: FOOD_LABELS,
    }),
  );
  it('плитки со сравнением и прежние testid', () => {
    expect(html).toMatch(/data-testid="food-period-revenue"[^>]*>2 660 ₸/);
    expect(html).toMatch(/data-testid="food-period-orders"[^>]*>2</);
    expect(html).toMatch(/data-testid="food-period-guests"[^>]*>5</);
    expect(html).toMatch(/data-testid="food-period-check"[^>]*>1 330 ₸/);
    expect(html).toMatch(/kpi-delta--up/);
  });
  it('брони по статусам, подсказки и разборы', () => {
    expect(html).toContain('Брони по статусам, всего 1');
    expect(html).toMatch(/data-testid="period-BOOKED"[^>]*>1</);
    expect(html).toContain('data-testid="pult-insights"');
    expect(html).toContain('Паста');
    expect(html).toContain('Kaspi');
  });
});
