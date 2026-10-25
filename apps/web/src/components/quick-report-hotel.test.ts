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
    expect(report.counts).toEqual([
      { label: 'Заездов', value: 1 },
      { label: 'Выездов', value: 1 },
    ]);
    expect(report.money.map((m) => [m.label, m.values])).toEqual([['Не оплачено по броням', { KZT: '500000' }]]);
  });
  it('период берёт брони всех дней отрезка один раз', () => {
    const report = hotelQuickReport(
      [{ cells: [cell('2026-10-24', 'a'), cell('2026-10-25', 'a'), cell('2026-10-26', 'b')] }],
      { from: '2026-10-24', to: '2026-10-26', currency: 'KZT' },
    );
    expect(report.total).toBe(2);
  });
});
