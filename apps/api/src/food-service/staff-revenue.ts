import type { DbTx } from '@pms/database';
import { parseRevenuePeriod, revenueSummary, revenueWindow, splitByWeights, type RevenueEntry } from '@pms/domain';

/**
 * «Сколько принёс сотрудник» салона и ресторана (docs/decisions/2026-10-20-personnel-revenue.md): оплачено минус
 * возвраты за окно периода по часам филиала. Салон: касса филиала с appointment_id, доли по строкам записи;
 * ресторан: restaurant_payments и возвраты кассы с order_id, сотрудник = официант заказа.
 */
type Db = Pick<DbTx, '$queryRaw'>;
type Scope = { locationId: string; timezone: string; vertical: 'FOOD_SERVICE' | 'BEAUTY' };

export async function branchStaffRevenue(db: Db, s: Scope, rawPeriod: unknown, now = new Date()) {
  const period = parseRevenuePeriod(rawPeriod);
  const w = revenueWindow(period, now, s.timezone);
  return { period, fromDate: w.fromDate, toDate: w.toDate, items: revenueSummary(await staffRevenueEntries(db, s, w)) };
}

/**
 * Те же деньги за явное окно [from, toExclusive). `employeeId` («только я», кабинет сотрудника, срез S2) сужает
 * выборку SQL до своих записей или заказов; доли многострочной записи делятся по всем её строкам, как в своде.
 */
export async function staffRevenueEntries(
  db: Db,
  s: Pick<Scope, 'locationId' | 'vertical'>,
  w: { from: Date; toExclusive: Date },
  employeeId?: string,
): Promise<RevenueEntry[]> {
  const entries: RevenueEntry[] = [];
  const me = employeeId ?? null;
  if (s.vertical === 'BEAUTY') {
    const money = await db.$queryRaw<Array<{ appointmentId: string; kind: 'INCOME' | 'EXPENSE'; amount: bigint; currency: string }>>`
      SELECT o.appointment_id::text AS "appointmentId", o.kind::text AS kind, o.amount, a.currency
      FROM restaurant_cash_operations o JOIN appointments a ON a.id = o.appointment_id
      WHERE o.location_id = ${s.locationId}::uuid AND o.appointment_id IS NOT NULL AND o.status = 'COMPLETED'
        AND o.kind IN ('INCOME', 'EXPENSE') AND o.occurred_at >= ${w.from} AND o.occurred_at < ${w.toExclusive}
        AND (${me}::uuid IS NULL OR a.employee_id = ${me}::uuid
          OR EXISTS (SELECT 1 FROM appointment_lines ml WHERE ml.appointment_id = a.id AND ml.employee_id = ${me}::uuid))
    `;
    const ids = [...new Set(money.map((m) => m.appointmentId))];
    const lines = ids.length
      ? await db.$queryRaw<Array<{ appointmentId: string; employeeId: string; price: bigint }>>`
          SELECT l.appointment_id::text AS "appointmentId", l.employee_id::text AS "employeeId", l.price_minor AS price
          FROM appointment_lines l WHERE l.appointment_id = ANY(${ids}::uuid[])
          ORDER BY l.appointment_id, l.starts_at, l.id
        `
      : [];
    const heads = ids.length
      ? await db.$queryRaw<Array<{ id: string; employeeId: string }>>`
          SELECT id::text, employee_id::text AS "employeeId" FROM appointments WHERE id = ANY(${ids}::uuid[])
        `
      : [];
    const head = new Map(heads.map((h) => [h.id, h.employeeId]));
    for (const m of money) {
      const own = lines.filter((l) => l.appointmentId === m.appointmentId);
      const who = own.length ? own : [{ employeeId: head.get(m.appointmentId)!, price: 1n }];
      splitByWeights(m.amount, who.map((l) => l.price)).forEach((part, i) =>
        entries.push({
          employeeId: who[i]!.employeeId,
          currency: m.currency,
          paidMinor: m.kind === 'INCOME' ? part : 0n,
          refundedMinor: m.kind === 'EXPENSE' ? part : 0n,
        }),
      );
    }
  } else {
    const paid = await db.$queryRaw<Array<{ waiterId: string | null; amount: bigint; currency: string }>>`
      SELECT o.waiter_id::text AS "waiterId", p.amount, p.currency
      FROM restaurant_payments p JOIN restaurant_orders o ON o.id = p.order_id
      WHERE p.location_id = ${s.locationId}::uuid AND p.status = 'COMPLETED'
        AND p.paid_at >= ${w.from} AND p.paid_at < ${w.toExclusive}
        AND (${me}::uuid IS NULL OR o.waiter_id = ${me}::uuid)
    `;
    const refunded = await db.$queryRaw<Array<{ waiterId: string | null; amount: bigint; currency: string }>>`
      SELECT o.waiter_id::text AS "waiterId", c.amount, o.currency
      FROM restaurant_cash_operations c JOIN restaurant_orders o ON o.id = c.order_id
      WHERE c.location_id = ${s.locationId}::uuid AND c.order_id IS NOT NULL AND c.kind = 'EXPENSE'
        AND c.status = 'COMPLETED' AND c.occurred_at >= ${w.from} AND c.occurred_at < ${w.toExclusive}
        AND (${me}::uuid IS NULL OR o.waiter_id = ${me}::uuid)
    `;
    for (const p of paid) entries.push({ employeeId: p.waiterId, currency: p.currency, paidMinor: p.amount, refundedMinor: 0n });
    for (const r of refunded) entries.push({ employeeId: r.waiterId, currency: r.currency, paidMinor: 0n, refundedMinor: r.amount });
  }
  return me === null ? entries : entries.filter((e) => e.employeeId === me);
}
