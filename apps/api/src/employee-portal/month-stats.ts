import type { Db, DbTx } from '@pms/database';
import { monthBounds, monthShiftDays, timeOffWindow, type PortalMonthStats } from '@pms/domain';
import { staffRevenueEntries } from '../food-service/staff-revenue';

/**
 * «Мой месяц» (срез S2, владелец 21.10.2026): итоги сотрудника за месяц по выбранному филиалу в его часовом поясе.
 * Всё читается только по своему employeeId: чужие записи, заказы и деньги в выборку не попадают.
 * Смены: дни с часами в недельном графике минус отсутствия (модели «смена на дату» нет). Бонусы: положительные
 * корректировки месяца, как в «Зарплате» (по всему бизнесу).
 */
export interface MonthStatsInput {
  employeeId: string;
  businessId: string;
  vertical: 'BEAUTY' | 'FOOD_SERVICE';
  location: { id: string; timezone: string; currency: string } | null;
  month: string;
  workingWeekdays: readonly number[];
  timeOffs: ReadonlyArray<{ dateFrom: string; dateTo: string }>;
  allowed: { schedule: boolean; work: boolean; pay: boolean };
}

export async function employeeMonthStats(db: Db | DbTx, i: MonthStatsInput): Promise<PortalMonthStats> {
  const empty: PortalMonthStats = {
    month: i.month, status: i.location ? 'AVAILABLE' : 'SELECT_LOCATION', currency: i.location?.currency ?? '',
    shifts: null, daysOff: null, absenceDays: null, appointmentsDone: null, servicesDone: null,
    ordersClosed: null, tablesServed: null, guests: null, revenueMinor: null, bonusMinor: null, percent: null,
  };
  if (!i.location) return empty;
  const out = { ...empty };
  const bounds = monthBounds(i.month);
  const w = timeOffWindow({ dateFrom: bounds.from, dateTo: bounds.to, timezone: i.location.timezone });
  if (i.allowed.schedule) Object.assign(out, monthShiftDays({ month: i.month, workingWeekdays: i.workingWeekdays, timeOffs: i.timeOffs }));
  const tasks: Array<Promise<void>> = [];
  if (i.allowed.work) {
    tasks.push(staffRevenueEntries(db, { locationId: i.location.id, vertical: i.vertical }, { from: w.fromUtc, toExclusive: w.toUtcExclusive }, i.employeeId)
      .then((entries) => {
        const own = entries.filter((e) => e.currency === i.location!.currency);
        out.revenueMinor = own.reduce((sum, e) => sum + e.paidMinor - e.refundedMinor, 0n).toString();
      }));
    if (i.vertical === 'BEAUTY') {
      tasks.push(db.appointmentLine.findMany({
        where: { employeeId: i.employeeId, appointment: { locationId: i.location.id, status: 'DONE', startsAt: { gte: w.fromUtc, lt: w.toUtcExclusive } } },
        select: { appointmentId: true },
      }).then((lines) => { out.servicesDone = lines.length; out.appointmentsDone = new Set(lines.map((l) => l.appointmentId)).size; }));
    } else {
      tasks.push(db.restaurantOrder.findMany({
        where: { waiterId: i.employeeId, locationId: i.location.id, status: 'CLOSED', closedAt: { gte: w.fromUtc, lt: w.toUtcExclusive } },
        select: { tableId: true, guestCount: true },
      }).then((orders) => {
        out.ordersClosed = orders.length;
        out.tablesServed = orders.filter((o) => o.tableId !== null).length;
        out.guests = orders.reduce((sum, o) => sum + o.guestCount, 0);
      }));
    }
  }
  if (i.allowed.pay) {
    tasks.push(db.employeePayAdjustment.aggregate({
      where: { employeeId: i.employeeId, employee: { businessId: i.businessId }, period: new Date(`${bounds.from}T00:00:00Z`), amountMinor: { gt: 0n } },
      _sum: { amountMinor: true },
    }).then((r) => { out.bonusMinor = (r._sum.amountMinor ?? 0n).toString(); }));
    tasks.push(db.employeePaySetting.findUnique({ where: { employeeId: i.employeeId }, select: { model: true, percent: true } })
      .then((s) => { out.percent = s && (s.model === 'PERCENT' || s.model === 'FIXED_PLUS_PERCENT') ? s.percent : null; }));
  }
  await Promise.all(tasks);
  return out;
}
