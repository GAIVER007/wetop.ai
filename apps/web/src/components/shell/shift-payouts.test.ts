import { describe, expect, it } from 'vitest';
import { shiftPayoutRows, type PayrollDayView } from './shift-payouts';

/**
 * Окно «Закрыть смену», вариант A (владелец 30.10.2026): мастера дня с клиентами, выручкой, процентом и «к выплате».
 * Раздел есть, только если сегодня кому-то платить: ежедневная всегда, недельная в свой день, месячная никогда.
 */
const row = (over: Partial<PayrollDayView['rows'][number]>): PayrollDayView['rows'][number] => ({
  employeeId: 'e', name: 'Amina', status: 'ACTIVE', payFrequency: 'DAILY', payWeekday: null, payMethod: 'CASH',
  salesMinor: '145000', clients: 6, percent: 40, accruedMinor: '58000', paidMinor: '0', remainingMinor: '58000', due: true,
  ...over,
});
const view = (rows: PayrollDayView['rows']): PayrollDayView => ({
  date: '2026-10-30', currency: 'QAR', payouts: true,
  totals: { accruedMinor: '0', paidMinor: '0', remainingMinor: '0' }, rows,
});

describe('выплаты мастерам в окне закрытия смены', () => {
  it('месячная и оклад не показываются: раздела нет', () => {
    expect(shiftPayoutRows(view([row({ payFrequency: 'MONTHLY', due: false }), row({ payFrequency: 'WEEKLY', payWeekday: 6, due: false })]))).toEqual([]);
  });
  it('ежедневная видна, недельная только в свой день; выплаченный остаётся со статусом', () => {
    const r = shiftPayoutRows(view([
      row({ employeeId: 'a' }),
      row({ employeeId: 'b', payFrequency: 'WEEKLY', payWeekday: 5, due: true }),
      row({ employeeId: 'c', paidMinor: '58000', remainingMinor: '0' }),
      row({ employeeId: 'd', payFrequency: 'MONTHLY', due: false }),
    ]));
    expect(r.map((x) => [x.employeeId, x.state])).toEqual([['a', 'due'], ['b', 'due'], ['c', 'paid']]);
  });
  it('мастер без клиентов и без начислений в окно не попадает', () => {
    expect(shiftPayoutRows(view([row({ clients: 0, salesMinor: '0', accruedMinor: '0', remainingMinor: '0' })]))).toEqual([]);
  });
  it('у гостиницы выплат из кассы нет', () => {
    expect(shiftPayoutRows({ ...view([row({})]), payouts: false })).toEqual([]);
  });
});
