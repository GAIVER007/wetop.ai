import type { DbTx } from '@pms/database';
import { dayAccrual, payDueOn, timeOffWindow, type PayFrequency } from '@pms/domain';

/**
 * Выплаты по дням (PAYROLL-DAILY-20261030, миграция 173): «начислено за день», «выплачено за день», «день выплаты».
 * Ничего не хранит: доля мастера от оказанных услуг дня (салон: выполненные строки записей; ресторан: закрытые
 * заказы официанта), как месячный расчёт `month-payroll.ts`, только окно одного дня по часам филиала.
 * Оклад делится на рабочие дни месяца (дни недели из графика сотрудника) только у ежедневной выплаты.
 */
export type DayPayrollDb = Pick<DbTx, 'employee' | 'restaurantOrder' | 'appointmentLine' | 'restaurantCashOperation' | 'workingHours'>;

/** Сколько дней месяца приходится на дни недели графика (ISO 1..7); без графика все дни месяца */
export function workDaysInMonth(day: string, weekdays: Set<number>): number {
  const [y, m] = day.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let n = 0;
  for (let d = 1; d <= last; d++) {
    const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
    if (!weekdays.size || weekdays.has(wd)) n++;
  }
  return n;
}

export async function dayPayrollRows(
  db: DayPayrollDb,
  s: { businessId: string; timezone: string; vertical: 'FOOD_SERVICE' | 'BEAUTY' | 'HOSPITALITY' },
  day: string,
) {
  const w = timeOffWindow({ dateFrom: day, dateTo: day, timezone: s.timezone });
  const payDate = new Date(`${day}T00:00:00Z`);
  const beauty = s.vertical === 'BEAUTY';
  const [employees, sales, paid, hours] = await Promise.all([
    db.employee.findMany({ where: { businessId: s.businessId }, include: { paySetting: true }, orderBy: { id: 'asc' } }),
    s.vertical === 'HOSPITALITY'
      ? Promise.resolve([] as Array<{ id: string; sum: bigint; clients: number }>)
      : beauty
        ? db.appointmentLine
            .findMany({
              where: { appointment: { location: { businessId: s.businessId }, status: 'DONE', startsAt: { gte: w.fromUtc, lt: w.toUtcExclusive } } },
              select: { employeeId: true, appointmentId: true, priceMinor: true },
            })
            .then((lines) => {
              // клиенты дня: разные записи мастера, выручка: сумма строк по снимкам цены
              const by = new Map<string, { sum: bigint; visits: Set<string> }>();
              for (const l of lines) {
                const v = by.get(l.employeeId) ?? { sum: 0n, visits: new Set<string>() };
                v.sum += l.priceMinor;
                v.visits.add(l.appointmentId);
                by.set(l.employeeId, v);
              }
              return [...by].map(([id, v]) => ({ id, sum: v.sum, clients: v.visits.size }));
            })
        : db.restaurantOrder
            .groupBy({
              by: ['waiterId'],
              where: { location: { businessId: s.businessId }, status: 'CLOSED', waiterId: { not: null }, closedAt: { gte: w.fromUtc, lt: w.toUtcExclusive } },
              _sum: { total: true },
              _count: { _all: true },
            })
            .then((r) => r.map((x) => ({ id: x.waiterId!, sum: x._sum.total ?? 0n, clients: x._count._all }))),
    db.restaurantCashOperation.groupBy({
      by: ['employeeId'],
      where: { location: { businessId: s.businessId }, payDate, status: 'COMPLETED', employeeId: { not: null } },
      _sum: { amount: true },
    }),
    db.workingHours.findMany({ where: { employee: { businessId: s.businessId } }, select: { employeeId: true, weekday: true } }),
  ]);
  const salesBy = new Map(sales.map((x) => [x.id, x.sum]));
  const clientsBy = new Map(sales.map((x) => [x.id, x.clients]));
  const paidBy = new Map(paid.map((x) => [x.employeeId!, x._sum.amount ?? 0n]));
  return employees.map((e) => {
    const p = e.paySetting;
    const setting = {
      model: p?.model ?? ('FIXED' as const),
      fixedMinor: p?.fixedMinor ?? 0n,
      percent: p?.percent ?? 0,
      payFrequency: (p?.payFrequency ?? 'MONTHLY') as PayFrequency,
      payWeekday: p?.payWeekday ?? null,
      payMethod: p?.payMethod ?? null,
    };
    // weekday в графике хранится 0..6 (вс=0), как у JS Date; приводим к ISO 1..7
    const weekdays = new Set(hours.filter((h) => h.employeeId === e.id).map((h) => h.weekday || 7));
    const salesMinor = salesBy.get(e.id) ?? 0n;
    const accrued = dayAccrual(setting, salesMinor, workDaysInMonth(day, weekdays));
    const paidMinor = paidBy.get(e.id) ?? 0n;
    return {
      e,
      setting,
      salesMinor,
      clients: clientsBy.get(e.id) ?? 0,
      accruedMinor: accrued,
      paidMinor,
      remainingMinor: accrued > paidMinor ? accrued - paidMinor : 0n,
      due: payDueOn(setting, day),
    };
  });
}
