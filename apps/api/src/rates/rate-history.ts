/**
 * Прежнее состояние правки цен и ограничений — для `before` в журнале (SECURITY.md §6). Массовая правка на год даёт
 * тысячи строк; в журнал они ложатся диапазонами: подряд идущие дни с одним значением сворачиваются в один.
 */
export interface PriceRun {
  occupancy: number;
  from: string;
  to: string;
  /** integer minor units строкой: bigint в JSON журнала не кладётся */
  priceMinor: string;
}

export interface RestrictionValues {
  minStay: number | null;
  maxStay: number | null;
  stopSell: boolean;
  closedToArrival: boolean;
  closedToDeparture: boolean;
}
export type RestrictionRun = { from: string; to: string } & RestrictionValues;

/** Прежние цены и ограничения одного изменения правки (одна категория и один тариф) */
export interface RateChangeBefore {
  accommodationTypeId: string;
  ratePlanId: string;
  prices: PriceRun[];
  restrictions: RestrictionRun[];
}

const nextDay = (date: string): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

export function priceRuns(
  rows: ReadonlyArray<{ date: string; occupancy: number; priceMinor: string }>,
): PriceRun[] {
  const sorted = [...rows].sort((a, b) => a.occupancy - b.occupancy || a.date.localeCompare(b.date));
  const runs: PriceRun[] = [];
  for (const r of sorted) {
    const last = runs.at(-1);
    if (
      last &&
      last.occupancy === r.occupancy &&
      last.priceMinor === r.priceMinor &&
      nextDay(last.to) === r.date
    )
      last.to = r.date;
    else runs.push({ occupancy: r.occupancy, from: r.date, to: r.date, priceMinor: r.priceMinor });
  }
  return runs;
}

const sameRestriction = (a: RestrictionValues, b: RestrictionValues) =>
  a.minStay === b.minStay &&
  a.maxStay === b.maxStay &&
  a.stopSell === b.stopSell &&
  a.closedToArrival === b.closedToArrival &&
  a.closedToDeparture === b.closedToDeparture;

export function restrictionRuns(
  rows: ReadonlyArray<{ date: string } & RestrictionValues>,
): RestrictionRun[] {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const runs: RestrictionRun[] = [];
  for (const { date, ...values } of sorted) {
    const last = runs.at(-1);
    if (last && sameRestriction(last, values) && nextDay(last.to) === date) last.to = date;
    else runs.push({ from: date, to: date, ...values });
  }
  return runs;
}
