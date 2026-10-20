import { describe, expect, it } from 'vitest';
import { parseRevenuePeriod, previousRevenueWindow, revenueSummary, revenueTotals, revenueWindow, splitByWeights } from './personnel-revenue';

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

// плитки «Персонала» (замечание владельца 20.10.2026: нужна полезная сводка): сравнение с прошлым периодом
describe('прошлый период для сравнения: та же часть периода, не весь', () => {
  const now = new Date('2026-10-21T20:30:00Z'); // чт 22.10, 01:30 по Алматы
  it('неделя: понедельник прошлой недели до того же дня и часа', () => {
    const w = previousRevenueWindow('week', now, 'Asia/Almaty');
    expect([w.fromDate, w.toDate]).toEqual(['2026-10-12', '2026-10-18']);
    expect(w.from.toISOString()).toBe('2026-10-11T19:00:00.000Z');
    expect(w.toExclusive.toISOString()).toBe('2026-10-14T20:30:00.000Z');
  });
  it('месяц: сентябрь, до 22-го 01:30; день: вчера до того же часа', () => {
    const m = previousRevenueWindow('month', now, 'Asia/Almaty');
    expect([m.fromDate, m.toDate]).toEqual(['2026-09-01', '2026-09-30']);
    expect(m.toExclusive.toISOString()).toBe('2026-09-21T20:30:00.000Z');
    const d = previousRevenueWindow('day', now, 'Asia/Almaty');
    expect(d.fromDate).toBe('2026-10-21');
    expect(d.toExclusive.toISOString()).toBe('2026-10-20T20:30:00.000Z');
  });
  it('31 марта против февраля: не дальше конца прошлого месяца', () => {
    const m = previousRevenueWindow('month', new Date('2027-03-31T10:00:00Z'), 'Asia/Almaty');
    expect(m.toExclusive.toISOString()).toBe('2027-02-28T19:00:00.000Z');
  });
});

describe('итоги по валютам', () => {
  it('оплачено, возвраты и чистые деньги, валюты отдельно', () => {
    expect(revenueTotals([
      { employeeId: 'a', currency: 'KZT', paidMinor: 1000n, refundedMinor: 100n },
      { employeeId: null, currency: 'KZT', paidMinor: 500n, refundedMinor: 0n },
      { employeeId: 'a', currency: 'USD', paidMinor: 7n, refundedMinor: 0n },
    ])).toEqual([
      { currency: 'KZT', paidMinor: '1500', refundedMinor: '100', netMinor: '1400' },
      { currency: 'USD', paidMinor: '7', refundedMinor: '0', netMinor: '7' },
    ]);
  });
});
