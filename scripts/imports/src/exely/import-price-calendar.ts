import type { DbTx } from '@pms/database';
import { ExelyImportError } from './errors';
import type { PriceCalendarImportPlan } from './price-calendar';

export interface UpsertCounts {
  created: number;
  updated: number;
  unchanged: number;
}
export interface PriceCalendarImportReport {
  period: { from: string; to: string };
  dailyRates: UpsertCounts;
  restrictions: UpsertCounts;
  /** Тарифы, у которых валюта в календаре Exely отличалась от сохранённой (например USD) */
  currencyChanged: Array<{ code: string; from: string; to: string }>;
}

const asDate = (d: string) => new Date(`${d}T00:00:00Z`);
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Идемпотентный импорт календаря цен и ограничений. Ключи — составные PK таблиц
 * `daily_rates` (date, category, tariff, occupancy) и `restrictions` (date, category, tariff).
 * Тарифы и категории ищутся по `exely_id` внутри объекта; неизвестный ID — ошибка, не догадка.
 * Строки вне периода календаря не трогаются. Один запрос на чтение + createMany на новые строки,
 * точечные update только для изменившихся.
 */
export async function importPriceCalendar(
  tx: DbTx,
  plan: PriceCalendarImportPlan,
  propertyId: string,
): Promise<PriceCalendarImportReport> {
  const report: PriceCalendarImportReport = {
    period: plan.period,
    dailyRates: { created: 0, updated: 0, unchanged: 0 },
    restrictions: { created: 0, updated: 0, unchanged: 0 },
    currencyChanged: [],
  };

  const ratePlans = await tx.ratePlan.findMany({
    where: { propertyId, exelyId: { in: plan.tariffs.map((t) => t.exelyId) } },
    select: { id: true, code: true, exelyId: true, currency: true },
  });
  const planByExely = new Map(ratePlans.map((p) => [p.exelyId!, p]));
  for (const t of plan.tariffs) {
    const rp = planByExely.get(t.exelyId);
    if (!rp)
      throw new ExelyImportError(
        `Календарь цен: тариф Exely ${t.exelyId} («${t.name}») не найден в БД — сначала импорт тарифов`,
      );
    if (rp.currency !== t.currency) {
      await tx.ratePlan.update({ where: { id: rp.id }, data: { currency: t.currency } });
      report.currencyChanged.push({ code: rp.code, from: rp.currency, to: t.currency });
    }
  }

  const typeExelyIds = [
    ...new Set([
      ...plan.dailyRates.map((r) => r.accommodationTypeExelyId),
      ...plan.restrictions.map((r) => r.accommodationTypeExelyId),
    ]),
  ];
  const types = await tx.accommodationType.findMany({
    where: { propertyId, exelyId: { in: typeExelyIds } },
    select: { id: true, exelyId: true },
  });
  const typeByExely = new Map(types.map((t) => [t.exelyId!, t.id]));
  for (const exelyId of typeExelyIds)
    if (!typeByExely.has(exelyId))
      throw new ExelyImportError(`Календарь цен: категория Exely ${exelyId} не найдена в БД`);

  const ratePlanIds = ratePlans.map((p) => p.id);
  const dateFilter = { gte: asDate(plan.period.from), lte: asDate(plan.period.to) };

  // ── daily_rates ──
  const existingRates = await tx.dailyRate.findMany({
    where: { ratePlanId: { in: ratePlanIds }, date: dateFilter },
    select: {
      date: true,
      accommodationTypeId: true,
      ratePlanId: true,
      occupancy: true,
      price: true,
    },
  });
  const rateKey = (d: string, at: string, rp: string, occ: number) => `${d}|${at}|${rp}|${occ}`;
  const existingRate = new Map(
    existingRates.map((r) => [
      rateKey(isoDay(r.date), r.accommodationTypeId, r.ratePlanId, r.occupancy),
      r.price,
    ]),
  );
  const newRates: Array<{
    date: Date;
    accommodationTypeId: string;
    ratePlanId: string;
    occupancy: number;
    price: bigint;
  }> = [];
  for (const r of plan.dailyRates) {
    const accommodationTypeId = typeByExely.get(r.accommodationTypeExelyId)!;
    const ratePlanId = planByExely.get(r.ratePlanExelyId)!.id;
    const key = rateKey(r.date, accommodationTypeId, ratePlanId, r.occupancy);
    const current = existingRate.get(key);
    if (current === undefined) {
      newRates.push({
        date: asDate(r.date),
        accommodationTypeId,
        ratePlanId,
        occupancy: r.occupancy,
        price: r.priceMinor,
      });
    } else if (current !== r.priceMinor) {
      await tx.dailyRate.update({
        where: {
          date_accommodationTypeId_ratePlanId_occupancy: {
            date: asDate(r.date),
            accommodationTypeId,
            ratePlanId,
            occupancy: r.occupancy,
          },
        },
        data: { price: r.priceMinor },
      });
      report.dailyRates.updated += 1;
    } else {
      report.dailyRates.unchanged += 1;
    }
  }
  if (newRates.length) {
    const res = await tx.dailyRate.createMany({ data: newRates });
    report.dailyRates.created = res.count;
  }

  // ── restrictions ──
  const existingRestrictions = await tx.restriction.findMany({
    where: { ratePlanId: { in: ratePlanIds }, date: dateFilter },
  });
  const restrKey = (d: string, at: string, rp: string) => `${d}|${at}|${rp}`;
  const existingRestr = new Map(
    existingRestrictions.map((r) => [
      restrKey(isoDay(r.date), r.accommodationTypeId, r.ratePlanId),
      r,
    ]),
  );
  const newRestrictions: Array<{
    date: Date;
    accommodationTypeId: string;
    ratePlanId: string;
    minStay: number | null;
    maxStay: number | null;
    stopSell: boolean;
    closedToArrival: boolean;
    closedToDeparture: boolean;
  }> = [];
  for (const r of plan.restrictions) {
    const accommodationTypeId = typeByExely.get(r.accommodationTypeExelyId)!;
    const ratePlanId = planByExely.get(r.ratePlanExelyId)!.id;
    const data = {
      minStay: r.minStay,
      maxStay: r.maxStay,
      stopSell: r.stopSell,
      closedToArrival: r.closedToArrival,
      closedToDeparture: r.closedToDeparture,
    };
    const current = existingRestr.get(restrKey(r.date, accommodationTypeId, ratePlanId));
    if (!current) {
      newRestrictions.push({ date: asDate(r.date), accommodationTypeId, ratePlanId, ...data });
    } else if (
      current.minStay !== data.minStay ||
      current.maxStay !== data.maxStay ||
      current.stopSell !== data.stopSell ||
      current.closedToArrival !== data.closedToArrival ||
      current.closedToDeparture !== data.closedToDeparture
    ) {
      await tx.restriction.update({
        where: {
          date_accommodationTypeId_ratePlanId: {
            date: asDate(r.date),
            accommodationTypeId,
            ratePlanId,
          },
        },
        data,
      });
      report.restrictions.updated += 1;
    } else {
      report.restrictions.unchanged += 1;
    }
  }
  if (newRestrictions.length) {
    const res = await tx.restriction.createMany({ data: newRestrictions });
    report.restrictions.created = res.count;
  }
  return report;
}
