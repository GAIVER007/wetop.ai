import { describe, expect, it } from 'vitest';
import { dayPayrollRows, workDaysInMonth, type DayPayrollDb } from './day-payroll';

/** PAYROLL-DAILY-20261030: начислено и выплачено за день, день выплаты; ничего не хранится */
describe('выплаты по дням', () => {
  it('рабочие дни месяца по графику (ISO), без графика все дни', () => {
    // октябрь 2026: 31 день, пятниц 5
    expect(workDaysInMonth('2026-10-14', new Set())).toBe(31);
    expect(workDaysInMonth('2026-10-14', new Set([5]))).toBe(5);
    expect(workDaysInMonth('2026-10-14', new Set([1, 2, 3, 4, 5]))).toBe(22);
  });

  it('процент дня, выплачено за день, кому платить сегодня', async () => {
    const db = {
      employee: {
        findMany: async () => [
          { id: 'a', name: 'Amina', status: 'ACTIVE', paySetting: { model: 'PERCENT', fixedMinor: 0n, percent: 40, payFrequency: 'DAILY', payWeekday: null, payMethod: 'CASH' } },
          { id: 'b', name: 'Lina', status: 'ACTIVE', paySetting: { model: 'FIXED', fixedMinor: 310000n, percent: 0, payFrequency: 'MONTHLY', payWeekday: null, payMethod: null } },
          { id: 'c', name: 'Noor', status: 'ACTIVE', paySetting: null },
        ],
      },
      appointmentLine: { groupBy: async () => [{ employeeId: 'a', _sum: { priceMinor: 50000n } }] },
      restaurantOrder: { groupBy: async () => { throw new Error('салон не читает заказы'); } },
      restaurantCashOperation: {
        groupBy: async (q: { where: { payDate: Date } }) => {
          expect(q.where.payDate.toISOString().slice(0, 10)).toBe('2026-10-14');
          return [{ employeeId: 'a', _sum: { amount: 5000n } }];
        },
      },
      workingHours: { findMany: async () => [] },
    } as unknown as DayPayrollDb;
    const rows = await dayPayrollRows(db, { businessId: 'x', timezone: 'Asia/Qatar', vertical: 'BEAUTY' }, '2026-10-14');
    const a = rows.find((r) => r.e.id === 'a')!;
    expect([a.accruedMinor, a.paidMinor, a.remainingMinor, a.due]).toEqual([20000n, 5000n, 15000n, true]);
    // месячный оклад по дням не делится и в середине месяца не к выплате
    const b = rows.find((r) => r.e.id === 'b')!;
    expect([b.accruedMinor, b.due]).toEqual([0n, false]);
    // без настройки: месяц, ноль
    const c = rows.find((r) => r.e.id === 'c')!;
    expect([c.setting.payFrequency, c.accruedMinor]).toEqual(['MONTHLY', 0n]);
  });
});
