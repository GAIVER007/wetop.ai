/**
 * Значения ARI для Channex из наших данных (ari.md): доступность по категориям — отдельным сообщением,
 * цены и ограничения — другим. Подряд идущие дни с одним значением сжимаются в date_from/date_to:
 * полный год умещается в 2 вызова (лимит 10 запросов/мин на эндпоинт, rate-limits.md).
 */
import type { channex } from '@pms/integrations';
import {
  buildChessboard,
  dateRange,
  MAX_CHESSBOARD_DAYS,
  type ChessboardAllocation,
  type ChessboardBlock,
  type ChessboardUnit,
} from '@pms/domain';

export interface RoomTypeMapping {
  localCategoryCode: string;
  providerRoomTypeId: string;
}
export interface RatePlanMapping {
  localCategoryCode: string;
  localRatePlanId: string;
  providerRatePlanId: string;
}
export interface LocalDailyRate {
  date: string;
  accommodationTypeCode: string;
  ratePlanId: string;
  occupancy: number;
  priceMinor: bigint;
}
export interface LocalRestriction {
  date: string;
  accommodationTypeCode: string;
  ratePlanId: string;
  minStay: number | null;
  maxStay: number | null;
  stopSell: boolean;
  closedToArrival: boolean;
  closedToDeparture: boolean;
}

const plusDays = (iso: string, n: number) => {
  const x = new Date(`${iso}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

/** Сжимает последовательность дат в диапазоны с одинаковым ключом значения. */
export function compressRuns<T>(
  dates: string[],
  valueAt: (date: string) => T | null,
  key: (v: T) => string,
): Array<{ from: string; to: string; value: T }> {
  const out: Array<{ from: string; to: string; value: T }> = [];
  let cur: { from: string; to: string; value: T; k: string } | null = null;
  for (const d of dates) {
    const v = valueAt(d);
    if (v === null) {
      if (cur) out.push({ from: cur.from, to: cur.to, value: cur.value });
      cur = null;
      continue;
    }
    const k = key(v);
    if (cur && cur.k === k && plusDays(cur.to, 1) === d) cur.to = d;
    else {
      if (cur) out.push({ from: cur.from, to: cur.to, value: cur.value });
      cur = { from: d, to: d, value: v, k };
    }
  }
  if (cur) out.push({ from: cur.from, to: cur.to, value: cur.value });
  return out;
}

/** Свободно ячеек категории на каждую ночь: активные − занятые − заблокированные (домен шахматки, кусками ≤ 62 дня). */
export function freeUnitsPerNight(input: {
  from: string;
  to: string;
  units: ChessboardUnit[];
  allocations: ChessboardAllocation[];
  blocks: ChessboardBlock[];
}): Map<string, Map<string, number>> {
  const byCategory = new Map<string, Map<string, number>>();
  const dates = dateRange(input.from, input.to);
  for (let i = 0; i < dates.length; i += MAX_CHESSBOARD_DAYS) {
    const chunk = dates.slice(i, i + MAX_CHESSBOARD_DAYS);
    const board = buildChessboard({
      from: chunk[0]!,
      to: chunk[chunk.length - 1]!,
      units: input.units,
      allocations: input.allocations,
      blocks: input.blocks,
    });
    // byCategory шахматки: дата → код категории → сводка
    for (const [date, cats] of Object.entries(board.byCategory)) {
      for (const [code, s] of Object.entries(cats)) {
        const m = byCategory.get(code) ?? new Map<string, number>();
        m.set(date, s.free);
        byCategory.set(code, m);
      }
    }
  }
  return byCategory;
}

export function buildAvailabilityValues(input: {
  propertyId: string;
  from: string;
  to: string;
  roomTypes: RoomTypeMapping[];
  free: Map<string, Map<string, number>>;
}): channex.ChannexAvailabilityValue[] {
  const dates = dateRange(input.from, input.to);
  const values: channex.ChannexAvailabilityValue[] = [];
  for (const rt of input.roomTypes) {
    const perDate = input.free.get(rt.localCategoryCode);
    if (!perDate) throw new Error(`Нет данных доступности для категории ${rt.localCategoryCode}`);
    for (const run of compressRuns(dates, (d) => perDate.get(d) ?? null, String)) {
      values.push({
        property_id: input.propertyId,
        room_type_id: rt.providerRoomTypeId,
        date_from: run.from,
        date_to: run.to,
        availability: run.value,
      });
    }
  }
  return values;
}

/** Цена (minor units, integer) и ограничения по датам для каждого сопоставленного тарифа. Дни без цены → stop_sell. */
export function buildRestrictionValues(input: {
  propertyId: string;
  from: string;
  to: string;
  ratePlans: RatePlanMapping[];
  dailyRates: LocalDailyRate[];
  restrictions: LocalRestriction[];
  /** occupancy, по которому берётся цена (primary option = вместимость категории) */
  occupancyByCategory: Record<string, number>;
}): channex.ChannexRestrictionValue[] {
  const dates = dateRange(input.from, input.to);
  const values: channex.ChannexRestrictionValue[] = [];
  for (const rp of input.ratePlans) {
    const occ = input.occupancyByCategory[rp.localCategoryCode];
    if (!occ) throw new Error(`Нет occupancy для категории ${rp.localCategoryCode}`);
    const rates = new Map(
      input.dailyRates
        .filter(
          (r) =>
            r.accommodationTypeCode === rp.localCategoryCode &&
            r.ratePlanId === rp.localRatePlanId &&
            r.occupancy === occ,
        )
        .map((r) => [r.date, r.priceMinor]),
    );
    const restr = new Map(
      input.restrictions
        .filter(
          (r) =>
            r.accommodationTypeCode === rp.localCategoryCode && r.ratePlanId === rp.localRatePlanId,
        )
        .map((r) => [r.date, r]),
    );
    type V = {
      rate: bigint | null;
      stop: boolean;
      min: number | null;
      max: number | null;
      cta: boolean;
      ctd: boolean;
    };
    const at = (d: string): V => {
      const r = restr.get(d);
      const rate = rates.get(d) ?? null;
      return {
        rate,
        stop: rate === null || (r?.stopSell ?? false),
        min: r?.minStay ?? null,
        max: r?.maxStay ?? null,
        cta: r?.closedToArrival ?? false,
        ctd: r?.closedToDeparture ?? false,
      };
    };
    for (const run of compressRuns(
      dates,
      at,
      (v) => `${v.rate ?? '-'}|${v.stop}|${v.min ?? '-'}|${v.max ?? '-'}|${v.cta}|${v.ctd}`,
    )) {
      const v = run.value;
      const change: channex.ChannexRestrictionValue = {
        property_id: input.propertyId,
        rate_plan_id: rp.providerRatePlanId,
        date_from: run.from,
        date_to: run.to,
        stop_sell: v.stop,
        closed_to_arrival: v.cta,
        closed_to_departure: v.ctd,
        min_stay_arrival: v.min ?? 1,
        min_stay_through: v.min ?? 1,
        max_stay: v.max ?? 0,
      };
      if (v.rate !== null) change.rate = Number(v.rate); // integer minor units (ari.md → rate)
      values.push(change);
    }
  }
  return values;
}


/**
 * Последний день с заведённой ценой (по вместимости категории) среди тарифов выгрузки; null — цен нет.
 * Полная выгрузка не шлёт ограничения дальше него: Channex требует `rate` в каждом объекте (сертификация §1).
 */
export function lastPricedDate(
  dailyRates: LocalDailyRate[],
  occupancyByCategory: Record<string, number>,
): string | null {
  let mx: string | null = null;
  for (const r of dailyRates) {
    if (r.occupancy !== occupancyByCategory[r.accommodationTypeCode]) continue;
    if (mx === null || r.date > mx) mx = r.date;
  }
  return mx;
}
