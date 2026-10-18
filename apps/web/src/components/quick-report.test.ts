import { describe, expect, it } from 'vitest';
import { beautyQuickReport, foodQuickReport, orderQuickReport } from './quick-report-data';

describe('calendar quick reports', () => {
  it('provides reference totals and status groups without losing no-shows or rounding money', () => {
    const report = beautyQuickReport([
      {
        id: '1',
        status: 'DONE',
        priceMinor: '9007199254740993',
        currency: 'KZT',
        customer: { id: 'a' },
      },
      { id: '2', status: 'BOOKED', priceMinor: '7', currency: 'KZT', customer: { id: 'b' } },
      { id: '3', status: 'NO_SHOW', priceMinor: '10', currency: 'USD', customer: { id: 'c' } },
    ]);
    expect(report.reference?.totalPrices).toEqual({ KZT: '9007199254741000', USD: '10' });
    expect(report.reference?.statuses.map((s) => [s.label, s.count])).toEqual([
      ['Обслуженные', 1],
      ['В ожидании', 1],
      ['Отменённые', 0],
      ['Не пришли', 1],
    ]);
  });
  it('counts unique customers and every status, keeping exact completed amounts by currency', () => {
    const row = (
      id: string,
      status: string,
      customerId: string,
      priceMinor = '100',
      currency = 'KZT',
    ) => ({ id, status, customer: { id: customerId }, priceMinor, currency });
    const report = beautyQuickReport([
      row('1', 'DONE', 'a', '9007199254740993'),
      row('2', 'DONE', 'a', '7'),
      row('3', 'BOOKED', 'b'),
      row('4', 'CANCELLED', 'c'),
      row('5', 'NO_SHOW', 'd'),
      row('6', 'DONE', 'e', '120', 'USD'),
    ]);
    expect(report.total).toBe(6);
    expect(report.clients).toBe(5);
    expect(report.statuses.find((s) => s.key === 'DONE')?.count).toBe(3);
    expect(report.money[0]?.values).toEqual({ KZT: '9007199254741000', USD: '120' });
  });
  it('splits appointment receipts by method without a redundant all-booking price', () => {
    const report = beautyQuickReport([
      {
        id: 'a',
        status: 'DONE',
        priceMinor: '100',
        currency: 'KZT',
        customer: { id: 'c' },
        paidCashMinor: '40',
        paidNonCashMinor: '60',
      },
    ]);
    expect(report.money.find((m) => m.label === 'Оплата наличными')?.values).toEqual({ KZT: '40' });
    expect(report.money.find((m) => m.label === 'Оплата безналом')?.values).toEqual({ KZT: '60' });
    expect(report.money.some((m) => m.label === 'Стоимость всех записей')).toBe(false);
  });
  it('distinguishes no completed services from a completed service with a zero price', () => {
    expect(beautyQuickReport([]).money[0]?.values).toEqual({});
    expect(
      beautyQuickReport([
        { id: 'free', status: 'DONE', priceMinor: '0', currency: 'KZT', customer: { id: 'a' } },
      ]).money[0]?.values,
    ).toEqual({ KZT: '0' });
  });
  it('rejects duplicate records and malformed money rather than showing false totals', () => {
    expect(() =>
      beautyQuickReport([
        { id: '1', status: 'DONE', priceMinor: '1.5', currency: 'KZT', customer: { id: 'a' } },
      ]),
    ).toThrow();
    expect(() =>
      foodQuickReport([
        { id: '1', status: 'BOOKED', customerId: 'a' },
        { id: '1', status: 'BOOKED', customerId: 'a' },
      ]),
    ).toThrow();
  });
  it('keeps booking counts separate from unavailable financial data', () => {
    const report = foodQuickReport([
      { id: '1', status: 'SEATED', customerId: 'a' },
      { id: '2', status: 'COMPLETED', customerId: 'a' },
      { id: '3', status: 'CANCELLED', customerId: 'b' },
    ]);
    expect(report.total).toBe(3);
    expect(report.clients).toBe(2);
    expect(report.money).toEqual([]);
    expect(report.statuses.reduce((n, s) => n + s.count, 0)).toBe(3);
  });
  it('sums only closed orders and does not invent unique restaurant customer counts', () => {
    const report = orderQuickReport([
      { id: '1', status: 'CLOSED', totalMinor: '10001', currency: 'KZT' },
      { id: '2', status: 'NEW', totalMinor: '70000', currency: 'KZT' },
      { id: '3', status: 'CANCELLED', totalMinor: '90000', currency: 'KZT' },
    ]);
    expect(report.total).toBe(3);
    expect(report.clients).toBeNull();
    expect(report.money[0]?.values).toEqual({ KZT: '10001' });
  });
  it('shows actual appointment payments and refunds separately from prices', () => {
    const report = beautyQuickReport([
      {
        id: 'a',
        status: 'DONE',
        priceMinor: '10001',
        currency: 'KZT',
        paidMinor: '10001',
        refundedMinor: '2000',
        customer: { id: 'c' },
      },
      {
        id: 'b',
        status: 'DONE',
        priceMinor: '20000',
        currency: 'KZT',
        paidMinor: '20000',
        refundedMinor: '0',
        customer: { id: 'c' },
      },
    ]);
    expect(report.money.find((m) => m.label === 'Принято оплат по записям')?.values).toEqual({
      KZT: '30001',
    });
    expect(report.money.find((m) => m.label === 'Возвращено по записям')?.values).toEqual({
      KZT: '2000',
    });
    expect(
      report.money.find((m) => m.label === 'Средняя стоимость завершённой записи')?.values,
    ).toEqual({ KZT: '15000' });
  });
  it('excludes voided order payments and keeps refunds separate from cash/card totals', () => {
    const payment = (
      id: string,
      amountMinor: string,
      method: 'CASH' | 'KASPI',
      status: 'COMPLETED' | 'VOIDED',
    ) => ({ id, amountMinor, method, status, paidAt: '2026-10-12T05:00:00Z', voidReason: null });
    const report = orderQuickReport([
      {
        id: '1',
        status: 'CLOSED',
        totalMinor: '1000',
        currency: 'KZT',
        refundedMinor: '200',
        payments: [
          payment('a', '400', 'CASH', 'COMPLETED'),
          payment('b', '600', 'KASPI', 'COMPLETED'),
          payment('c', '9999', 'CASH', 'VOIDED'),
        ],
      },
    ]);
    expect(report.money.find((m) => m.label === 'Наличными по заказам')?.values).toEqual({
      KZT: '400',
    });
    expect(report.money.find((m) => m.label === 'Безналично по заказам')?.values).toEqual({
      KZT: '600',
    });
    expect(report.money.find((m) => m.label === 'Возвращено по заказам')?.values).toEqual({
      KZT: '200',
    });
  });
});

describe('Beauty report service-line discounts', () => {
  it('sums stored discounts per currency once per visit and excludes cancelled visits', () => {
    const report = beautyQuickReport([
      {
        id: 'usd',
        status: 'BOOKED',
        customer: { id: 'c' },
        priceMinor: '700',
        currency: 'USD',
        items: [{ discountMinor: '100' }, { discountMinor: '200' }],
      },
      {
        id: 'jpy',
        status: 'DONE',
        customer: { id: 'c' },
        priceMinor: '500',
        currency: 'JPY',
        items: [{ discountMinor: '50' }],
      },
      {
        id: 'cancelled',
        status: 'CANCELLED',
        customer: { id: 'd' },
        priceMinor: '0',
        currency: 'USD',
        items: [{ discountMinor: '999' }],
      },
    ]);
    expect(report.total).toBe(3);
    expect(report.money.find((m) => m.label === 'Скидки на услуги')?.values).toEqual({
      USD: '300',
      JPY: '50',
    });
    expect(report.note).not.toContain('Скидки и бонусы: отдельный учёт');
    expect(report.money.flatMap((m) => m.hint).join(' ')).not.toContain('тиына');
  });
});
