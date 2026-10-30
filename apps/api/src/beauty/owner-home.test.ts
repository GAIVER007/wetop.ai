import { describe, expect, it } from 'vitest';
import { buildOwnerHome, sixMonths, type OwnerHomeSource } from './owner-home';

/**
 * Главная владельца салона, вариант «B» (владелец 30.10.2026: «Вариант б хочу»). Месяц по часам филиала. Выручка как
 * на прежней Главной: выполненные записи по цене; прибыль = выручка минус оплаченные расходы кассы. Путь клиента по
 * людям месяца: записались, пришли, оплатили, вернулись повторно (были до этого месяца). Деньги в минорных единицах.
 */
const row = (o: Partial<OwnerHomeSource['appointments'][number]> & { id: string; customerId: string; month: string }) => ({
  employeeId: 'e1',
  status: 'DONE' as const,
  priceMinor: 10000n,
  source: 'DESK',
  paid: true,
  lines: [] as Array<{ employeeId: string; priceMinor: bigint }>,
  ...o,
});

const src = (): OwnerHomeSource => ({
  month: '2026-10',
  currency: 'QAR',
  appointments: [
    row({ id: 'a1', customerId: 'c1', month: '2026-10', source: 'INSTAGRAM' }),
    row({ id: 'a2', customerId: 'c1', month: '2026-10', source: 'INSTAGRAM', priceMinor: 5000n }),
    row({ id: 'a3', customerId: 'c2', month: '2026-10', employeeId: 'e2', source: 'WHATSAPP', paid: false }),
    row({ id: 'a4', customerId: 'c3', month: '2026-10', status: 'NO_SHOW' }),
    row({ id: 'a5', customerId: 'c4', month: '2026-10', status: 'CANCELLED' }),
    // запись на два мастера: цена делится по строкам
    row({ id: 'a6', customerId: 'c5', month: '2026-10', priceMinor: 9000n, lines: [{ employeeId: 'e1', priceMinor: 6000n }, { employeeId: 'e2', priceMinor: 3000n }] }),
    row({ id: 'b1', customerId: 'c1', month: '2026-09', priceMinor: 7000n }),
    row({ id: 'b2', customerId: 'c9', month: '2026-05', priceMinor: 1000n }),
  ],
  firstDone: new Map([
    ['c1', '2026-09'],
    ['c2', '2026-10'],
    ['c5', '2026-03'],
    ['c9', '2026-05'],
  ]),
  lapsed: 7,
  expenses: [
    { month: '2026-10', amountMinor: 4000n },
    { month: '2026-09', amountMinor: 1000n },
  ],
  reviews: [
    { employeeId: 'e1', stars: 5 },
    { employeeId: 'e1', stars: 4 },
  ],
  employees: new Map([
    ['e1', 'Айгерим'],
    ['e2', 'Дана'],
  ]),
});

describe('Главная владельца салона «B»', () => {
  it('четыре цифры месяца и сравнение с прошлым', () => {
    const v = buildOwnerHome(src());
    // выручка октября: 10000 + 5000 + 10000 + 9000 = 34000 (неявка и отмена не выручка)
    expect(v.kpi).toEqual({
      revenueMinor: '34000',
      // владелец 30.10.2026: «на главной выручка, должны быть расходы, прибыль»
      expensesMinor: '4000',
      profitMinor: '30000',
      // оплатили: c1, c5 (c2 не оплатил)
      paidClients: 2,
      averageMinor: '8500',
      previous: { revenueMinor: '7000', expensesMinor: '1000', profitMinor: '6000', paidClients: 1, averageMinor: '7000' },
    });
  });

  it('путь клиента: записались, пришли, оплатили, вернулись; % от прошлого шага', () => {
    const v = buildOwnerHome(src());
    expect(v.funnel).toEqual([
      { step: 'BOOKED', count: 5, percent: null },
      { step: 'CAME', count: 3, percent: 60 },
      { step: 'PAID', count: 2, percent: 67 },
      { step: 'RETURNED', count: 2, percent: 100 },
    ]);
    // новые: c2 (первый визит в октябре); не пришли: одна неявка; давно не были из источника
    expect(v.clients).toEqual({ new: 1, noShow: 1, lapsed: 7 });
  });

  it('мастера: выручка по строкам записи, визиты, постоянные клиенты, оценка', () => {
    const v = buildOwnerHome(src());
    expect(v.masters).toEqual([
      { employeeId: 'e1', name: 'Айгерим', revenueMinor: '21000', visits: 3, customers: 2, returning: 2, reviews: 2, avgTenths: 45 },
      { employeeId: 'e2', name: 'Дана', revenueMinor: '13000', visits: 2, customers: 2, returning: 1, reviews: 0, avgTenths: null },
    ]);
  });

  it('откуда клиенты: оплатившие по источнику записи, выручка источника', () => {
    expect(buildOwnerHome(src()).sources).toEqual([
      { source: 'INSTAGRAM', clients: 1, revenueMinor: '15000' },
      { source: 'DESK', clients: 1, revenueMinor: '9000' },
    ]);
  });

  it('шесть месяцев: выручка, расходы, прибыль; выбранный последним', () => {
    const m = buildOwnerHome(src()).months;
    expect(m.map((x) => x.month)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(m[0]).toEqual({ month: '2026-05', revenueMinor: '1000', expensesMinor: '0', profitMinor: '1000' });
    expect(m[5]).toEqual({ month: '2026-10', revenueMinor: '34000', expensesMinor: '4000', profitMinor: '30000' });
  });

  // владелец 30.10.2026: «470,69 QAR с копейками, округлять нужно»: средний чек целыми, половина вверх
  it('средний чек округлён до целых: 471,62 даёт 472, 100,50 даёт 101, 100,33 даёт 100', () => {
    const many = Array.from({ length: 43 }, (_, i) => row({ id: `m${i}`, customerId: `m${i}`, month: '2026-10', priceMinor: i < 42 ? 47000n : 50000n + 4000n }));
    // 42 × 470 + 540 = 20 280; 20 280 / 43 = 471,62: 472
    expect(buildOwnerHome({ ...src(), appointments: many, expenses: [] }).kpi.averageMinor).toBe('47200');
    const two = [row({ id: 'x1', customerId: 'x1', month: '2026-10', priceMinor: 10000n }), row({ id: 'x2', customerId: 'x2', month: '2026-10', priceMinor: 10100n })];
    expect(buildOwnerHome({ ...src(), appointments: two, expenses: [] }).kpi.averageMinor).toBe('10100');
    const three = [...two.slice(0, 1), row({ id: 'x3', customerId: 'x3', month: '2026-10', priceMinor: 10000n }), row({ id: 'x4', customerId: 'x4', month: '2026-10', priceMinor: 10100n })];
    expect(buildOwnerHome({ ...src(), appointments: three, expenses: [] }).kpi.averageMinor).toBe('10000');
  });

  it('пустой месяц: нули без деления на ноль, средний чек пустой', () => {
    const v = buildOwnerHome({ ...src(), appointments: [], expenses: [], reviews: [] });
    expect(v.kpi.averageMinor).toBeNull();
    expect(v.funnel.map((f) => f.percent)).toEqual([null, null, null, null]);
    expect(v.masters).toEqual([]);
  });

  it('шесть месяцев назад от выбранного, через год', () => {
    expect(sixMonths('2026-02')).toEqual(['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02']);
  });
});
