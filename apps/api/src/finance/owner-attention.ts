import type { DbTx } from '@pms/database';
import { dayOffsetUtc, localDate, milliOf, zonedStartOfDay } from '@pms/domain';
import {
  freeWindowMasters,
  ownerAttention,
  PREPAY_HORIZON_DAYS,
  STALE_ORDER_MS,
  type OwnerAttentionItem,
} from '../../../../packages/domain/src/owner-summary/attention';
import { intersectLocationHours, salonHours } from '../beauty/location-hours-policy';

/**
 * «Требуют решения» Главной владельца (docs/decisions/2026-10-21-owner-home-attention.md). Только чтение, только
 * выбранный филиал (объект гостиницы через его `propertyId`), день СЕГОДНЯ по поясу филиала, независимо от периода.
 * Каждый источник читается отдельно: сбой одного убирает его строку, а не весь блок.
 */
export interface OwnerAttentionScope {
  locationId: string;
  organizationId: string;
  businessId: string;
  vertical: string;
  timezone: string;
  propertyId: string | null;
  now: Date;
  unclassifiedExpenses?: boolean;
}
type Db = Pick<DbTx, 'appointment' | 'appointmentLine' | 'employee' | 'beautyLocationHours' | 'restaurantOrder' | 'reservation' | 'inventoryUnit' | 'barProduct' | 'kitchenProduct'>;

const safe = async <T>(read: () => Promise<T>): Promise<T | null> => {
  try {
    return await read();
  } catch {
    return null;
  }
};
const clock = (t: Date) => t.toISOString().slice(11, 16);
const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const ACTIVE_ARRIVAL = ['TENTATIVE', 'CONFIRMED'] as const;

/** То же правило, что «Что заканчивается» на «Обзоре склада»: бар при остатке не выше минимума, кухня ниже минимума */
async function lowStock(db: Db, s: OwnerAttentionScope): Promise<number> {
  const [bar, kitchen] = await Promise.all([
    db.barProduct.findMany({
      where: { locationId: s.locationId, active: true },
      select: { minimumStockUnits: true, lots: { where: { remainingUnits: { gt: 0 } }, select: { remainingUnits: true } } },
    }),
    db.kitchenProduct.findMany({
      where: { businessId: s.businessId, active: true },
      select: { minQty: true, lots: { where: { locationId: s.locationId, reversedAt: null, remainingQty: { gt: 0 } }, select: { remainingQty: true } } },
    }),
  ]);
  const barLow = bar.filter((p) => p.lots.reduce((sum, l) => sum + BigInt(l.remainingUnits), 0n) <= BigInt(p.minimumStockUnits)).length;
  const kitchenLow = kitchen.filter((p) => {
    const min = milliOf(p.minQty);
    return min > 0n && p.lots.reduce((sum, l) => sum + milliOf(l.remainingQty), 0n) < min;
  }).length;
  return barLow + kitchenLow;
}

export async function readOwnerAttention(db: Db, s: OwnerAttentionScope): Promise<OwnerAttentionItem[]> {
  const today = localDate(s.now, s.timezone);
  const dayStart = zonedStartOfDay(today, s.timezone);
  const dayEnd = zonedStartOfDay(dayOffsetUtc(today, 1), s.timezone);
  const extra: OwnerAttentionItem[] = s.unclassifiedExpenses
    ? [{ id: 'unclassified-expenses', tone: 'warn', text: 'Есть расходы без статьи', href: s.vertical === 'FOOD_SERVICE' ? '/restaurant-finance' : '/finance', action: 'Разобрать' }]
    : [];
  const stock = safe(() => lowStock(db, s));

  if (s.vertical === 'BEAUTY') {
    const unpaidDone = safe(async () => {
      const rows = await db.appointment.findMany({
        where: { locationId: s.locationId, status: 'DONE', startsAt: { gte: dayStart, lt: dayEnd } },
        select: { price: true, payments: { where: { status: 'COMPLETED' }, select: { kind: true, amount: true } } },
      });
      return rows.filter((r) => r.payments.reduce((sum, p) => (p.kind === 'INCOME' ? sum + p.amount : sum), 0n) < r.price).length;
    });
    const freeMasters = safe(async () => {
      const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
      const [employees, lines, opening] = await Promise.all([
        db.employee.findMany({
          where: {
            businessId: s.businessId, status: 'ACTIVE', locations: { some: { locationId: s.locationId } },
            timeOffs: { none: { dateFrom: { lte: new Date(`${today}T00:00:00Z`) }, dateTo: { gte: new Date(`${today}T00:00:00Z`) } } },
          },
          select: { id: true, personnelKind: true, workingHours: { where: { locationId: s.locationId, weekday }, select: { timeFrom: true, timeTo: true } } },
        }),
        db.appointmentLine.findMany({
          where: {
            startsAt: { lt: dayEnd }, endsAt: { gt: dayStart },
            appointment: { locationId: s.locationId, status: { in: ['BOOKED', 'CONFIRMED', 'IN_PROGRESS', 'DONE'] } },
          },
          select: { employeeId: true, startsAt: true, endsAt: true },
        }),
        db.beautyLocationHours.findUnique({ where: { locationId: s.locationId } }),
      ]);
      const open = opening ? salonHours(opening.intervals) : null;
      const at = (d: Date) => Math.round((d.getTime() - dayStart.getTime()) / 60000);
      return freeWindowMasters(
        employees
          // «другой сотрудник» записей не принимает: его свободное время окном не считается
          .filter((e) => e.personnelKind !== 'OTHER_EMPLOYEE')
          .map((e) => ({
            employeeId: e.id,
            shifts: intersectLocationHours(e.workingHours.map((h) => ({ timeFrom: clock(h.timeFrom), timeTo: clock(h.timeTo) })), open, weekday)
              .map((h) => ({ from: minutes(h.timeFrom), to: minutes(h.timeTo) })),
          })),
        lines.map((l) => ({ employeeId: l.employeeId, from: at(l.startsAt), to: at(l.endsAt) })),
        at(s.now),
      );
    });
    return ownerAttention({ vertical: s.vertical, today, unpaidDone: await unpaidDone, freeMasters: await freeMasters, lowStock: await stock, extra });
  }

  if (s.vertical === 'FOOD_SERVICE') {
    const staleOrders = safe(() =>
      db.restaurantOrder.count({
        where: { locationId: s.locationId, status: { in: ['NEW', 'COOKING', 'READY', 'SERVED'] }, openedAt: { lt: new Date(s.now.getTime() - STALE_ORDER_MS) } },
      }),
    );
    return ownerAttention({ vertical: s.vertical, today, staleOrders: await staleOrders, lowStock: await stock, extra });
  }

  if (s.vertical === 'HOSPITALITY') {
    const propertyId = s.propertyId;
    const day = new Date(`${today}T00:00:00Z`);
    const arrivals = propertyId
      ? safe(() => db.reservation.count({ where: { propertyId, arrivalDate: day, status: { in: [...ACTIVE_ARRIVAL] } } }))
      : Promise.resolve(null);
    const dirty = propertyId
      ? safe(() => db.inventoryUnit.findMany({ where: { propertyId, active: true, housekeepingStatus: 'DIRTY' }, select: { kind: true } }))
      : Promise.resolve(null);
    // «Без предоплаты» = то же, что отбор «Не оплачено» списка броней: к оплате больше нуля, оплат ещё не было
    const noPrepay = propertyId
      ? safe(async () => {
          const rows = await db.reservation.findMany({
            where: {
              propertyId, status: { in: [...ACTIVE_ARRIVAL] },
              arrivalDate: { gte: day, lte: new Date(`${dayOffsetUtc(today, PREPAY_HORIZON_DAYS)}T00:00:00Z`) },
            },
            select: {
              items: {
                select: {
                  folio: {
                    select: {
                      charges: { where: { voidedAt: null }, select: { amount: true } },
                      allocations: { where: { payment: { status: 'COMPLETED' } }, select: { amount: true } },
                      refunds: { select: { amount: true } },
                    },
                  },
                },
              },
            },
          });
          return rows.filter((r) => {
            const sum = (pick: (f: NonNullable<(typeof r.items)[number]['folio']>) => Array<{ amount: bigint }>) =>
              r.items.reduce((total, i) => total + (i.folio ? pick(i.folio).reduce((t, x) => t + BigInt(x.amount), 0n) : 0n), 0n);
            const charged = sum((f) => f.charges), paid = sum((f) => f.allocations), refunded = sum((f) => f.refunds);
            return paid === 0n && charged - paid + refunded > 0n;
          }).length;
        })
      : Promise.resolve(null);
    const dirtyRows = await dirty;
    return ownerAttention({
      vertical: s.vertical, today,
      arrivals: await arrivals,
      dirtyRooms: dirtyRows ? dirtyRows.length : null,
      dirtyHasBeds: dirtyRows?.some((u) => u.kind === 'BED') ?? false,
      noPrepay: await noPrepay,
      lowStock: await stock,
      extra,
    });
  }
  return [];
}
