import { describe, expect, it } from 'vitest';
import { buildVerticalHome, type VerticalHomeSource } from './owner-home';

/**
 * Единая Главная «B» для ресторана и гостиницы (владелец 30.10.2026: «для ресторана и для гостиниц и для салонов
 * единая главная должна быть»). Деньги из продаж (ресторан: закрытые чеки, гостиница: начисления по дню услуги),
 * путь гостя из броней. Минорные единицы bigint, средний чек целыми, половина вверх.
 */
const src = (): VerticalHomeSource => ({
  vertical: 'FOOD_SERVICE',
  month: '2026-10',
  currency: 'QAR',
  steps: ['BOOKED', 'CAME', 'RETURNED'],
  sales: [
    { month: '2026-10', amountMinor: 10000n, visitId: 'o1', payerId: 'o1', staff: [{ id: 'w1', amountMinor: 10000n }] },
    { month: '2026-10', amountMinor: 5050n, visitId: 'o2', payerId: 'o2', staff: [{ id: 'w1', amountMinor: 5050n }] },
    { month: '2026-10', amountMinor: 7000n, visitId: 'o3', payerId: 'o3', staff: [{ id: 'w2', amountMinor: 7000n }] },
    // продажа бара: бармену (владелец 30.10.2026: «в ресторанах понятно, официанты и бармены»)
    { month: '2026-10', amountMinor: 1000n, visitId: 'bar1', payerId: 'bar1', staff: [{ id: 'b1', amountMinor: 1000n, role: 'BARTENDER' }] },
    { month: '2026-09', amountMinor: 3000n, visitId: 'o0', payerId: 'o0', staff: [{ id: 'w1', amountMinor: 3000n }] },
  ],
  visits: [
    { customerId: 'g1', month: '2026-10', status: 'CAME', paid: true, source: 'DESK', valueMinor: null },
    { customerId: 'g1', month: '2026-10', status: 'CAME', paid: true, source: 'DESK', valueMinor: null },
    { customerId: 'g2', month: '2026-10', status: 'CAME', paid: true, source: 'WEBSITE', valueMinor: null },
    { customerId: 'g3', month: '2026-10', status: 'NO_SHOW', paid: false, source: 'DESK', valueMinor: null },
    { customerId: 'g4', month: '2026-10', status: 'BOOKED', paid: false, source: 'DESK', valueMinor: null },
    { customerId: 'g5', month: '2026-09', status: 'CAME', paid: true, source: 'DESK', valueMinor: null },
  ],
  firstCame: new Map([
    ['g1', '2026-08'],
    ['g2', '2026-10'],
    ['g5', '2026-09'],
  ]),
  lapsed: 3,
  expenses: [{ month: '2026-10', amountMinor: 2000n }],
  ratings: [
    { staffId: 'w1', stars: 5 },
    { staffId: 'w1', stars: 4 },
  ],
  staffNames: new Map([
    ['w1', 'Айдана'],
    ['w2', 'Ерлан'],
    ['b1', 'Тимур'],
  ]),
  rooms: [],
});

describe('Единая Главная «B»: ресторан и гостиница', () => {
  it('цифры месяца: выручка, расходы, прибыль, оплаченные чеки, средний чек целыми', () => {
    const v = buildVerticalHome(src());
    // 10000 + 5050 + 7000 + 1000 = 23050; чеков 4; 23050 / 4 = 57,625: 58
    expect(v.kpi).toEqual({
      revenueMinor: '23050',
      expensesMinor: '2000',
      profitMinor: '21050',
      paidClients: 4,
      averageMinor: '5800',
      previous: { revenueMinor: '3000', expensesMinor: '0', profitMinor: '3000', paidClients: 1, averageMinor: '3000' },
    });
    expect(v.vertical).toBe('FOOD_SERVICE');
  });

  it('путь гостя из броней: только шаги направления, % от прошлого шага', () => {
    const v = buildVerticalHome(src());
    // забронировали g1..g4 (4), пришли g1, g2 (2), вернулись g1 (первый визит в августе)
    expect(v.funnel).toEqual([
      { step: 'BOOKED', count: 4, percent: null },
      { step: 'CAME', count: 2, percent: 50 },
      { step: 'RETURNED', count: 1, percent: 50 },
    ]);
    expect(v.clients).toEqual({ new: 1, noShow: 1, lapsed: 3 });
  });

  it('ресторан: официанты и бармены, все, по выручке; чеки, оценка, роль', () => {
    expect(buildVerticalHome(src()).masters).toEqual([
      { employeeId: 'w1', name: 'Айдана', role: 'WAITER', revenueMinor: '15050', visits: 2, customers: 2, returning: 0, reviews: 2, avgTenths: 45 },
      { employeeId: 'w2', name: 'Ерлан', role: 'WAITER', revenueMinor: '7000', visits: 1, customers: 1, returning: 0, reviews: 0, avgTenths: null },
      { employeeId: 'b1', name: 'Тимур', role: 'BARTENDER', revenueMinor: '1000', visits: 1, customers: 1, returning: 0, reviews: 0, avgTenths: null },
    ]);
  });

  it('гостиница: вместо мастеров категории номеров: ночи, гости, выручка, средняя цена ночи целыми', () => {
    const v = buildVerticalHome({
      ...src(),
      vertical: 'HOSPITALITY',
      // у брони гостиницы нет официанта: продажи без сотрудников
      sales: src().sales.map((x) => ({ ...x, staff: [] })),
      rooms: [
        { typeId: 'std', name: 'Стандарт', month: '2026-10', nights: 3, reservationId: 'r1', amountMinor: 30000n },
        { typeId: 'std', name: 'Стандарт', month: '2026-10', nights: 1, reservationId: 'r2', amountMinor: 10050n },
        { typeId: 'lux', name: 'Люкс', month: '2026-10', nights: 2, reservationId: 'r3', amountMinor: 50000n },
        { typeId: 'lux', name: 'Люкс', month: '2026-09', nights: 5, reservationId: 'r0', amountMinor: 99000n },
      ],
    });
    expect(v.masters).toEqual([]);
    // Люкс 50000 / 2 = 250; Стандарт 40050 / 4 = 100,125: 100
    expect(v.rooms).toEqual([
      { typeId: 'lux', name: 'Люкс', nights: 2, guests: 1, revenueMinor: '50000', avgNightMinor: '25000' },
      { typeId: 'std', name: 'Стандарт', nights: 4, guests: 2, revenueMinor: '40050', avgNightMinor: '10000' },
    ]);
  });

  it('откуда гости: пришедшие по источнику брони; суммы нет, если брони без денег', () => {
    expect(buildVerticalHome(src()).sources).toEqual([
      { source: 'DESK', clients: 1, revenueMinor: null },
      { source: 'WEBSITE', clients: 1, revenueMinor: null },
    ]);
  });

  it('гостиница: оплатили и сумма брони по источнику', () => {
    const s = src();
    const v = buildVerticalHome({
      ...s,
      vertical: 'HOSPITALITY',
      steps: ['BOOKED', 'CAME', 'PAID', 'RETURNED'],
      visits: [
        { customerId: 'g1', month: '2026-10', status: 'CAME', paid: true, source: 'OTA', valueMinor: 50000n },
        { customerId: 'g2', month: '2026-10', status: 'CAME', paid: false, source: 'DESK', valueMinor: 20000n },
        { customerId: 'g3', month: '2026-10', status: 'CANCELLED', paid: false, source: 'OTA', valueMinor: 9000n },
      ],
    });
    expect(v.funnel).toEqual([
      { step: 'BOOKED', count: 3, percent: null },
      { step: 'CAME', count: 2, percent: 67 },
      { step: 'PAID', count: 1, percent: 50 },
      { step: 'RETURNED', count: 1, percent: 100 },
    ]);
    expect(v.sources).toEqual([
      { source: 'OTA', clients: 1, revenueMinor: '50000' },
      { source: 'DESK', clients: 1, revenueMinor: '20000' },
    ]);
  });

  it('шесть месяцев и пустой месяц без деления на ноль', () => {
    const v = buildVerticalHome({ ...src(), sales: [], visits: [], expenses: [], ratings: [] });
    expect(v.months.map((m) => m.month)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(v.kpi.averageMinor).toBeNull();
    expect(v.funnel.map((f) => f.percent)).toEqual([null, null, null]);
    expect(v.masters).toEqual([]);
  });
});
