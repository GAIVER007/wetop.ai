import type { Db, DbTx } from '@pms/database';
import type { DailyRateImportRow, RestrictionImportRow } from './price-calendar';

const asDate = (d: string) => new Date(`${d}T00:00:00Z`);
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Обратное чтение календаря из БД в терминах Exely ID — для сверки с снимком. */
export async function readRatesFromDb(
  db: Db | DbTx,
  propertyId: string,
  period: { from: string; to: string },
): Promise<{
  dailyRates: DailyRateImportRow[];
  restrictions: RestrictionImportRow[];
  names: { ratePlans: Record<string, string>; accommodationTypes: Record<string, string> };
}> {
  const [plans, types] = await Promise.all([
    db.ratePlan.findMany({
      where: { propertyId },
      select: { id: true, exelyId: true, name: true },
    }),
    db.accommodationType.findMany({
      where: { propertyId },
      select: { id: true, exelyId: true, name: true },
    }),
  ]);
  const planExely = new Map(plans.map((p) => [p.id, p.exelyId ?? p.id]));
  const typeExely = new Map(types.map((t) => [t.id, t.exelyId ?? t.id]));
  const dateFilter = { gte: asDate(period.from), lte: asDate(period.to) };
  const [rates, restrictions] = await Promise.all([
    db.dailyRate.findMany({
      where: { ratePlanId: { in: plans.map((p) => p.id) }, date: dateFilter },
      orderBy: [
        { ratePlanId: 'asc' },
        { accommodationTypeId: 'asc' },
        { occupancy: 'asc' },
        { date: 'asc' },
      ],
    }),
    db.restriction.findMany({
      where: { ratePlanId: { in: plans.map((p) => p.id) }, date: dateFilter },
    }),
  ]);
  return {
    dailyRates: rates.map((r) => ({
      date: isoDay(r.date),
      ratePlanExelyId: planExely.get(r.ratePlanId)!,
      accommodationTypeExelyId: typeExely.get(r.accommodationTypeId)!,
      occupancy: r.occupancy,
      priceMinor: r.price,
    })),
    restrictions: restrictions.map((r) => ({
      date: isoDay(r.date),
      ratePlanExelyId: planExely.get(r.ratePlanId)!,
      accommodationTypeExelyId: typeExely.get(r.accommodationTypeId)!,
      minStay: r.minStay,
      maxStay: r.maxStay,
      stopSell: r.stopSell,
      closedToArrival: r.closedToArrival,
      closedToDeparture: r.closedToDeparture,
    })),
    names: {
      ratePlans: Object.fromEntries(plans.map((p) => [p.exelyId ?? p.id, p.name])),
      accommodationTypes: Object.fromEntries(types.map((t) => [t.exelyId ?? t.id, t.name])),
    },
  };
}
