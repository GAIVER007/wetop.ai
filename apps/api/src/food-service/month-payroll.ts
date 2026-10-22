import type { DbTx } from '@pms/database';
import { payrollTotals, timeOffWindow } from '@pms/domain';

/**
 * Общий расчёт «к выплате за месяц» (§33.4, §19.2): один код у руководителя («Зарплата», /payroll) и в кабинете
 * сотрудника (/my-work), чтобы суммы не расходились (владелец 21.10.2026, срез S1).
 * Зарплата принадлежит бизнесу (ADR-181): процент и «выплачено» по всем филиалам, окно месяца по часам
 * выбранного филиала. База процента: у ресторана закрытые заказы официанта, у салона выполненные строки записей.
 * `employeeId` сужает выборку до одного сотрудника (кабинет «только я»), формула та же.
 */
export type MonthPayrollDb = Pick<
  DbTx,
  'employee' | 'restaurantOrder' | 'appointmentLine' | 'employeePayAdjustment' | 'restaurantCashOperation'
>;
export interface MonthPayrollScope {
  businessId: string;
  timezone: string;
  vertical: 'FOOD_SERVICE' | 'BEAUTY' | 'HOSPITALITY';
}

export async function monthPayrollRows(
  db: MonthPayrollDb,
  s: MonthPayrollScope,
  m: { from: string; to: string },
  employeeId?: string,
) {
  const w = timeOffWindow({ dateFrom: m.from, dateTo: m.to, timezone: s.timezone });
  const period = new Date(`${m.from}T00:00:00Z`);
  const only = employeeId === undefined ? {} : { employeeId };
  const [employees, orders, adjustments, payouts] = await Promise.all([
    db.employee.findMany({
      where: { businessId: s.businessId, ...(employeeId === undefined ? {} : { id: employeeId }) },
      include: { paySetting: true },
      orderBy: { id: 'asc' },
    }),
    // зарплата принадлежит бизнесу (ADR-181): процент и «выплачено» по всем филиалам,
    // иначе бизнес с двумя филиалами показывает и может выплатить один оклад дважды
    // база процента: у ресторана закрытые заказы официанта, у салона выполненные записи мастера (§19.2)
    s.vertical === 'BEAUTY'
      ? db.appointmentLine
          .groupBy({
            by: ['employeeId'],
            where: {
              ...only,
              appointment: {
                location: { businessId: s.businessId },
                status: 'DONE',
                startsAt: { gte: w.fromUtc, lt: w.toUtcExclusive },
              },
            },
            _sum: { priceMinor: true },
          })
          .then((rows) => rows.map((r) => ({ waiterId: r.employeeId, _sum: { total: r._sum.priceMinor } })))
      : db.restaurantOrder.groupBy({
          by: ['waiterId'],
          where: {
            location: { businessId: s.businessId },
            status: 'CLOSED',
            waiterId: employeeId === undefined ? { not: null } : employeeId,
            closedAt: { gte: w.fromUtc, lt: w.toUtcExclusive },
          },
          _sum: { total: true },
        }),
    db.employeePayAdjustment.findMany({
      where: { employee: { businessId: s.businessId }, period, ...only },
      orderBy: { createdAt: 'asc' },
    }),
    db.restaurantCashOperation.groupBy({
      by: ['employeeId'],
      where: {
        location: { businessId: s.businessId },
        period,
        status: 'COMPLETED',
        employeeId: employeeId === undefined ? { not: null } : employeeId,
      },
      _sum: { amount: true },
    }),
  ]);
  const salesByWaiter = new Map(orders.map((o) => [o.waiterId!, o._sum.total ?? 0n]));
  const paidByEmployee = new Map(payouts.map((p) => [p.employeeId!, p._sum.amount ?? 0n]));
  const rows = employees.map((e) => {
    const setting = e.paySetting
      ? { model: e.paySetting.model, fixedMinor: e.paySetting.fixedMinor, percent: e.paySetting.percent }
      : { model: 'FIXED' as const, fixedMinor: 0n, percent: 0 };
    const sales = salesByWaiter.get(e.id) ?? 0n;
    const adj = adjustments.filter((a) => a.employeeId === e.id).map((a) => a.amountMinor);
    return { e, setting, sales, t: payrollTotals(setting, sales, adj), paid: paidByEmployee.get(e.id) ?? 0n };
  });
  return { period, rows, adjustments };
}
