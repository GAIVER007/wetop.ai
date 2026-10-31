import { describe, expect, it } from 'vitest';
import { hotelQuickReport } from './quick-report-data';

const cell = (date: string, itemId: string, extra: Record<string, unknown> = {}) => ({
  date,
  state: 'OCCUPIED',
  itemId,
  itemStatus: 'CONFIRMED',
  confirmationNumber: `N-${itemId}`,
  guestLabel: `Гость ${itemId}`,
  ...extra,
});

describe('hotelQuickReport: «Быстрый отчёт» гостиницы по календарю (владелец 23.10.2026)', () => {
  it('считает брони дня один раз, заезды, выезды и долг по уникальным броням', () => {
    const report = hotelQuickReport(
      [
        { cells: [cell('2026-10-24', 'a', { isArrival: true, balanceMinor: '500000' }), cell('2026-10-25', 'a', { balanceMinor: '500000' })] },
        { cells: [cell('2026-10-24', 'b', { itemStatus: 'CHECKED_IN', isLastNight: true }), { date: '2026-10-25', state: 'FREE' }] },
        { cells: [{ date: '2026-10-24', state: 'BLOCKED' }, cell('2026-10-25', 'c', { isArrival: true })] },
      ],
      { from: '2026-10-24', to: '2026-10-24', currency: 'KZT' },
    );
    expect(report.total).toBe(2);
    expect(report.itemLabel).toBe('Броней');
    expect(report.statuses.find((s) => s.key === 'CONFIRMED')?.count).toBe(1);
    expect(report.statuses.find((s) => s.key === 'CHECKED_IN')?.count).toBe(1);
    // 31.10.2026 «как под салоны»: заезды и выезды убраны, долг остаётся строкой финансов
    expect(report.counts).toBeUndefined();
    expect(report.money.find((m) => m.label === 'Не оплачено по броням')?.values).toEqual({ KZT: '500000' });
  });
  it('период берёт брони всех дней отрезка один раз', () => {
    const report = hotelQuickReport(
      [{ cells: [cell('2026-10-24', 'a'), cell('2026-10-25', 'a'), cell('2026-10-26', 'b')] }],
      { from: '2026-10-24', to: '2026-10-26', currency: 'KZT' },
    );
    expect(report.total).toBe(2);
  });
});

describe('отчёт гостиницы карточкой салона (владелец 31.10.2026: «сделай как под салоны», статусы оставить)', () => {
  it('сумма броней, выручка (оплачено), средний чек, наличные и безнал, долг; без заездов и пояснений', () => {
    const report = hotelQuickReport(
      [
        { cells: [cell('2026-10-24', 'a', { totalMinor: '3000', paidCashMinor: '1000', paidNonCashMinor: '500', balanceMinor: '1500' })] },
        { cells: [cell('2026-10-24', 'b', { itemStatus: 'CHECKED_IN', totalMinor: '1000', paidCashMinor: '0', paidNonCashMinor: '1000', balanceMinor: '0' })] },
      ],
      { from: '2026-10-24', to: '2026-10-24', currency: 'KZT' },
    );
    expect(report.reference?.statusTitle).toBe('Статусы');
    expect(report.reference?.dots).toBe(true);
    expect(report.reference?.statuses.map((s) => s.key)).toEqual(report.statuses.map((s) => s.key));
    expect(report.reference?.totalLabel).toBe('Сумма броней');
    expect(report.reference?.totalPrices).toEqual({ KZT: '4000' });
    expect(report.reference?.revenue).toEqual({ KZT: '2500' });
    expect(report.reference?.average).toEqual({ KZT: '2000' });
    expect(report.reference?.loyalty).toBe(false);
    const money = Object.fromEntries(report.money.map((m) => [m.label, m.values]));
    expect(money['Оплата наличными']).toEqual({ KZT: '1000' });
    expect(money['Оплата безналом']).toEqual({ KZT: '1500' });
    expect(money['Не оплачено по броням']).toEqual({ KZT: '1500' });
    expect(report.counts).toBeUndefined();
  });
  it('нет броней: суммы «Нет данных», а не ноль', () => {
    const report = hotelQuickReport([], { from: '2026-10-24', to: '2026-10-24', currency: 'KZT' });
    expect(report.reference?.totalPrices).toEqual({});
    expect(report.reference?.revenue).toEqual({});
  });
});

