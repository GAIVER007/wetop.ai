import { describe, expect, it } from 'vitest';
import { parseFoodPayout } from './cash';
import { dayAccrual, parsePaySettings, payDueOn } from './restaurant';

/** PAYROLL-DAILY-20261030 (DATA_MODEL): как часто платим и за какой день выплата */
describe('частота выплаты зарплаты', () => {
  it('без частоты прежняя настройка не меняется', () => {
    const s = parsePaySettings({ model: 'PERCENT', fixedMinor: 0, percent: 40 });
    expect('payFrequency' in s).toBe(false);
  });
  it('день, неделя с днём недели, месяц', () => {
    expect(parsePaySettings({ model: 'PERCENT', fixedMinor: 0, percent: 40, payFrequency: 'DAILY' })).toMatchObject({
      payFrequency: 'DAILY', payWeekday: null,
    });
    expect(parsePaySettings({ model: 'PERCENT', fixedMinor: 0, percent: 40, payFrequency: 'WEEKLY', payWeekday: 6 })).toMatchObject({
      payFrequency: 'WEEKLY', payWeekday: 6,
    });
    expect(() => parsePaySettings({ model: 'PERCENT', fixedMinor: 0, percent: 40, payFrequency: 'WEEKLY' })).toThrow('день недели');
    expect(() => parsePaySettings({ model: 'PERCENT', fixedMinor: 0, percent: 40, payFrequency: 'DAILY', payWeekday: 2 })).toThrow();
    expect(() => parsePaySettings({ model: 'PERCENT', fixedMinor: 0, percent: 40, payFrequency: 'YEARLY' })).toThrow();
  });
  it('чем обычно платим: способ кассы или ничего', () => {
    expect(parsePaySettings({ model: 'FIXED', fixedMinor: 1, percent: 0, payFrequency: 'MONTHLY', payMethod: 'CASH' }).payMethod).toBe('CASH');
    expect(() => parsePaySettings({ model: 'FIXED', fixedMinor: 1, percent: 0, payFrequency: 'MONTHLY', payMethod: 'BONUS' })).toThrow();
  });
  it('день выплаты: каждый день, свой день недели, первое число', () => {
    expect(payDueOn({ payFrequency: 'DAILY', payWeekday: null }, '2026-10-14')).toBe(true);
    expect(payDueOn({ payFrequency: 'WEEKLY', payWeekday: 6 }, '2026-10-31')).toBe(true); // суббота
    expect(payDueOn({ payFrequency: 'WEEKLY', payWeekday: 6 }, '2026-10-30')).toBe(false);
    expect(payDueOn({ payFrequency: 'MONTHLY', payWeekday: null }, '2026-11-01')).toBe(true);
    expect(payDueOn({ payFrequency: 'MONTHLY', payWeekday: null }, '2026-11-02')).toBe(false);
  });
});

describe('выплата за день', () => {
  it('payDate задаёт день, месяц из него', () => {
    expect(parseFoodPayout({ period: '2026-10', payDate: '2026-10-14', method: 'CASH', amount: 5000 })).toEqual({
      period: '2026-10-01', payDate: '2026-10-14', method: 'CASH', amount: 5000n,
    });
  });
  it('день вне месяца и неверная дата отклоняются', () => {
    expect(() => parseFoodPayout({ period: '2026-10', payDate: '2026-11-01', method: 'CASH', amount: 1 })).toThrow('месяц');
    expect(() => parseFoodPayout({ period: '2026-10', payDate: '2026-10-32', method: 'CASH', amount: 1 })).toThrow();
  });
  it('без payDate как раньше, payDate null', () => {
    expect(parseFoodPayout({ period: '2026-10', method: 'CASH', amount: 1 }).payDate).toBeNull();
  });
});

describe('начислено за день (расчёт, не хранится)', () => {
  const pct = { model: 'PERCENT' as const, fixedMinor: 0n, percent: 40, payFrequency: 'DAILY' as const };
  it('процент от оказанных услуг дня', () => {
    expect(dayAccrual(pct, 50000n, 22)).toBe(20000n);
  });
  it('оклад делится на рабочие дни только у ежедневной выплаты', () => {
    const fx = { model: 'FIXED_PLUS_PERCENT' as const, fixedMinor: 220000n, percent: 10, payFrequency: 'DAILY' as const };
    expect(dayAccrual(fx, 10000n, 22)).toBe(10000n + 1000n);
    expect(dayAccrual({ ...fx, payFrequency: 'MONTHLY' }, 10000n, 22)).toBe(1000n);
    expect(dayAccrual(fx, 0n, 0)).toBe(0n);
  });
});
