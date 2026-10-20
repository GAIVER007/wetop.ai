import { describe, expect, it } from 'vitest';
import { parseRevenuePeriod, revenueSummary, revenueWindow, splitByWeights } from './personnel-revenue';

// «Сколько принёс сотрудник» (решение владельца 20.10.2026, docs/decisions/2026-10-20-personnel-revenue.md)
describe('период «принёс»: день, неделя с понедельника, месяц по часам филиала', () => {
  const now = new Date('2026-10-21T20:30:00Z'); // в Алматы (UTC+5) уже 22.10, четверг
  it('день', () => {
    expect(revenueWindow('day', now, 'Asia/Almaty')).toEqual({
      fromDate: '2026-10-22', toDate: '2026-10-22',
      from: new Date('2026-10-21T19:00:00Z'), toExclusive: new Date('2026-10-22T19:00:00Z'),
    });
  });
  it('неделя начинается в понедельник', () => {
    const w = revenueWindow('week', now, 'Asia/Almaty');
    expect([w.fromDate, w.toDate]).toEqual(['2026-10-19', '2026-10-25']);
    expect(w.from.toISOString()).toBe('2026-10-18T19:00:00.000Z');
  });
  it('месяц', () => {
    const w = revenueWindow('month', now, 'Asia/Almaty');
    expect([w.fromDate, w.toDate]).toEqual(['2026-10-01', '2026-10-31']);
    expect(w.toExclusive.toISOString()).toBe('2026-10-31T19:00:00.000Z');
  });
  it('разбор периода строгий, по умолчанию день', () => {
    expect(parseRevenuePeriod(undefined)).toBe('day');
    expect(parseRevenuePeriod('month')).toBe('month');
    expect(() => parseRevenuePeriod('year')).toThrow(RangeError);
  });
});

describe('деление оплаты пропорционально цене услуг, в целых тиынах', () => {
  it('сумма долей равна платежу, остаток крупнейшим остаткам', () => {
    expect(splitByWeights(1000n, [1n, 1n, 1n])).toEqual([334n, 333n, 333n]);
    expect(splitByWeights(10000n, [3000n, 7000n])).toEqual([3000n, 7000n]);
    expect(splitByWeights(-100n, [1n, 2n])).toEqual([-33n, -67n]);
  });
  it('нулевые веса: делится поровну', () => {
    expect(splitByWeights(5n, [0n, 0n])).toEqual([3n, 2n]);
  });
  it('пустой список не принимается', () => {
    expect(() => splitByWeights(5n, [])).toThrow(RangeError);
  });
});

describe('свод по сотрудникам', () => {
  it('оплаты минус возвраты по валютам, без привязки отдельной строкой, порядок по убыванию', () => {
    const rows = revenueSummary([
      { employeeId: 'a', currency: 'KZT', paidMinor: 5000n, refundedMinor: 0n },
      { employeeId: 'b', currency: 'KZT', paidMinor: 9000n, refundedMinor: 0n },
      { employeeId: 'a', currency: 'KZT', paidMinor: 0n, refundedMinor: 1000n },
      { employeeId: null, currency: 'KZT', paidMinor: 700n, refundedMinor: 0n },
      { employeeId: 'a', currency: 'USD', paidMinor: 100n, refundedMinor: 0n },
    ]);
    expect(rows).toEqual([
      { employeeId: 'b', currency: 'KZT', paidMinor: '9000', refundedMinor: '0', netMinor: '9000' },
      { employeeId: 'a', currency: 'KZT', paidMinor: '5000', refundedMinor: '1000', netMinor: '4000' },
      { employeeId: null, currency: 'KZT', paidMinor: '700', refundedMinor: '0', netMinor: '700' },
      { employeeId: 'a', currency: 'USD', paidMinor: '100', refundedMinor: '0', netMinor: '100' },
    ]);
  });
});
