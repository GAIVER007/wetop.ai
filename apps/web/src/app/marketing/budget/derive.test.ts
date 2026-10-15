import { describe, expect, it } from 'vitest';
import { byDay, byPlatform, monthDelta, summarize, type BudgetExpense } from './derive';

const e = (over: Partial<BudgetExpense>): BudgetExpense => ({
  id: 'x',
  date: '2026-10-05',
  platform: 'META',
  campaign: null,
  category: 'Реклама',
  description: null,
  amount: '12000',
  currency: 'KZT',
  fxRate: '1',
  baseAmount: '12000',
  countedInBudget: true,
  ...over,
});

describe('сводка бюджета месяца (экран «Бюджет», МКТ-В2)', () => {
  it('текущий месяц: израсходовано, остаток, прогноз и дни', () => {
    const t = summarize({
      month: '2026-10',
      today: '2026-10-12',
      plan: '300000',
      expenses: [
        e({ baseAmount: '120000' }),
        e({ baseAmount: '72000' }),
        e({ baseAmount: '999999', countedInBudget: false }), // вне бюджета не считается
      ],
    });
    expect(t.spent).toBe(192000n);
    expect(t.remainder).toBe(108000n);
    expect(t.daysInMonth).toBe(31);
    expect(t.daysPassed).toBe(12);
    expect(t.daysLeft).toBe(19);
    // 192000 / 12 × 31 = 496000
    expect(t.forecast).toBe(496000n);
    expect(t.onTrack).toBe(false);
    expect(t.planUsedPct).toBe(64);
  });

  it('прошлый месяц: прогноз равен факту, дней до конца ноль', () => {
    const t = summarize({
      month: '2026-09',
      today: '2026-10-12',
      plan: null,
      expenses: [e({ date: '2026-09-10', baseAmount: '50000' })],
    });
    expect(t.forecast).toBe(50000n);
    expect(t.daysLeft).toBe(0);
    expect(t.remainder).toBeNull();
    expect(t.onTrack).toBeNull();
  });

  it('будущий месяц: прогноза нет, дни впереди целиком', () => {
    const t = summarize({ month: '2026-11', today: '2026-10-12', plan: '100', expenses: [] });
    expect(t.forecast).toBeNull();
    expect(t.daysLeft).toBe(30);
    expect(t.daysPassed).toBe(0);
  });

  it('первый день месяца без расходов: деление на ноль не случается', () => {
    const t = summarize({ month: '2026-10', today: '2026-10-01', plan: '100', expenses: [] });
    expect(t.spent).toBe(0n);
    expect(t.forecast).toBe(0n);
  });
});

describe('распределение по платформам', () => {
  it('доли считаются от учтённых расходов и сортируются по убыванию', () => {
    const rows = byPlatform([
      e({ platform: 'META', baseAmount: '72000' }),
      e({ platform: 'GOOGLE', baseAmount: '48000' }),
      e({ platform: 'META', baseAmount: '0', countedInBudget: false, amount: '1' }),
      e({ platform: 'TIKTOK', baseAmount: '36000' }),
      e({ platform: 'GOOGLE', baseAmount: '0', countedInBudget: false, amount: '1' }),
      e({ platform: 'OTHER', baseAmount: '12000' }),
      e({ platform: 'INSTAGRAM', baseAmount: '24000' }),
    ]);
    expect(rows.map((r) => r.platform)).toEqual(['META', 'GOOGLE', 'TIKTOK', 'INSTAGRAM', 'OTHER']);
    expect(rows[0]).toMatchObject({ base: 72000n, share: 38 });
    expect(rows.reduce((s, r) => s + r.share, 0)).toBeGreaterThanOrEqual(99);
  });

  it('пусто: пустой список', () => {
    expect(byPlatform([])).toEqual([]);
  });
});

describe('расходы по дням для графика', () => {
  it('каждый день месяца на месте, суммы в тиынах', () => {
    const days = byDay(
      [
        e({ date: '2026-10-01', baseAmount: '100' }),
        e({ date: '2026-10-01', baseAmount: '50' }),
        e({ date: '2026-10-31', baseAmount: '70', countedInBudget: false }), // в графике участвует
      ],
      '2026-10',
    );
    expect(days).toHaveLength(31);
    expect(days[0]).toBe(150n);
    expect(days[30]).toBe(70n);
    expect(days[15]).toBe(0n);
  });
});

describe('динамика к прошлому месяцу', () => {
  it('рост и падение в процентах, без прошлого месяца: null', () => {
    expect(monthDelta(120000n, 100000n)).toBe(20);
    expect(monthDelta(80000n, 100000n)).toBe(-20);
    expect(monthDelta(100n, 0n)).toBeNull();
  });
});
