/**
 * Календарь цен и ограничений Exely — снимок внутреннего API страницы «Цены и ограничения»
 * (`project-input/exely/prices/README.md`). Серии RLE `[значение|null, дней]` разворачиваются
 * в строки `DailyRate` (одна на дату × тариф × категория × occupancy) и `Restriction`
 * (одна на дату × тариф × категория, только если хоть одно ограничение задано).
 *
 * Правила: ничего не угадывать — неизвестное размещение, расходящаяся длина серии или
 * ограничение, которого нет в модели (DATA_MODEL §5), — ошибка с указанием тарифа и категории.
 */
import { ExelyImportError } from './errors';
import { toMinorUnits } from './normalize-reservation';

export interface PriceCalendarTariff {
  exelyId: string;
  name: string;
  currency: string;
  parentExelyId: string | null;
}
export interface DailyRateImportRow {
  /** YYYY-MM-DD, дата ночи в timezone объекта */
  date: string;
  ratePlanExelyId: string;
  accommodationTypeExelyId: string;
  occupancy: number;
  /** integer minor units (тиын / цент), ADR-008 */
  priceMinor: bigint;
}
export interface RestrictionImportRow {
  date: string;
  ratePlanExelyId: string;
  accommodationTypeExelyId: string;
  minStay: number | null;
  maxStay: number | null;
  stopSell: boolean;
  closedToArrival: boolean;
  closedToDeparture: boolean;
}
export interface PriceCalendarImportPlan {
  capturedAt: string;
  period: { from: string; to: string };
  tariffs: PriceCalendarTariff[];
  dailyRates: DailyRateImportRow[];
  restrictions: RestrictionImportRow[];
}

type Rle = Array<[string | null, number]>;
interface RawPlacement {
  id: string;
  name: string;
  prices: Rle;
}
interface RawRoomType {
  exelyId: string;
  name: string;
  placements: RawPlacement[];
  restrictions?: Record<string, Rle>;
}
interface RawTariff {
  exelyId: string;
  name: string;
  parentExelyId: string | null;
  currency: string;
  roomTypes: RawRoomType[];
}
interface RawCalendar {
  capturedAt: string;
  startDate: string;
  daysCount: number;
  tariffs: RawTariff[];
}

/** Размещение Exely → occupancy. Только основные места: «1 осн.» / «2 осн.» (DATA_MODEL §5). */
const OCCUPANCY_BY_PLACEMENT: Record<string, number> = { '1 осн.': 1, '2 осн.': 2 };

/** Показатели Exely → поля Restriction. Остальные показатели поддерживаются только пустыми. */
const RESTRICTION_FIELDS = {
  StopSell: 'stopSell',
  MinLOS: 'minStay',
  MaxLOS: 'maxStay',
  CTA: 'closedToArrival',
  CTD: 'closedToDeparture',
} as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d) + days * 86_400_000).toISOString().slice(0, 10);
}

function expectRle(rle: unknown, daysCount: number, where: string): Rle {
  if (!Array.isArray(rle)) throw new ExelyImportError(`${where}: серия не массив`);
  let total = 0;
  for (const run of rle as unknown[]) {
    if (
      !Array.isArray(run) ||
      run.length !== 2 ||
      !Number.isInteger(run[1]) ||
      (run[1] as number) <= 0
    )
      throw new ExelyImportError(`${where}: элемент серии должен быть [значение, дней>0]`);
    if (run[0] !== null && typeof run[0] !== 'string')
      throw new ExelyImportError(`${where}: значение серии должно быть строкой или null`);
    total += run[1] as number;
  }
  if (total !== daysCount)
    throw new ExelyImportError(`${where}: серия покрывает ${total} дней, ожидалось ${daysCount}`);
  return rle as Rle;
}

/** Разворачивает серию в массив длиной daysCount. */
function expand(rle: Rle, daysCount: number): Array<string | null> {
  const out: Array<string | null> = new Array(daysCount);
  let i = 0;
  for (const [value, days] of rle) for (let k = 0; k < days; k += 1, i += 1) out[i] = value;
  return out;
}

function parsePrice(raw: string, where: string): bigint {
  if (!/^\d+(\.\d{1,4})?$/.test(raw))
    throw new ExelyImportError(`${where}: цена «${raw}» не десятичное число`);
  return toMinorUnits(Number(raw), where);
}

function parseIntOrNull(raw: string | null, where: string): number | null {
  if (raw === null || raw === '') return null;
  if (!/^\d+$/.test(raw)) throw new ExelyImportError(`${where}: «${raw}» не целое`);
  return Number(raw);
}

function parseFlag(raw: string | null): boolean {
  return raw !== null && raw !== '' && raw !== '0' && raw.toLowerCase() !== 'false';
}

function asCalendar(input: unknown): RawCalendar {
  const c = input as Partial<RawCalendar> | null;
  if (!c || typeof c !== 'object') throw new ExelyImportError('Календарь цен: не объект');
  if (typeof c.startDate !== 'string' || !ISO_DATE.test(c.startDate))
    throw new ExelyImportError('Календарь цен: startDate не в формате YYYY-MM-DD');
  if (!Number.isInteger(c.daysCount) || (c.daysCount as number) <= 0)
    throw new ExelyImportError('Календарь цен: daysCount должен быть положительным целым');
  if (!Array.isArray(c.tariffs) || c.tariffs.length === 0)
    throw new ExelyImportError('Календарь цен: нет тарифов');
  return {
    capturedAt: typeof c.capturedAt === 'string' ? c.capturedAt : c.startDate,
    startDate: c.startDate,
    daysCount: c.daysCount as number,
    tariffs: c.tariffs as RawTariff[],
  };
}

export function parseExelyPriceCalendar(input: unknown): PriceCalendarImportPlan {
  const cal = asCalendar(input);
  const dates = Array.from({ length: cal.daysCount }, (_, i) => addDays(cal.startDate, i));
  const tariffs: PriceCalendarTariff[] = [];
  const dailyRates: DailyRateImportRow[] = [];
  const restrictions: RestrictionImportRow[] = [];

  for (const t of cal.tariffs) {
    if (!/^\d+$/.test(String(t.exelyId)))
      throw new ExelyImportError(`Тариф с некорректным ID: «${String(t.exelyId)}»`);
    if (typeof t.currency !== 'string' || !/^[A-Z]{3}$/.test(t.currency))
      throw new ExelyImportError(`Тариф ${t.exelyId}: валюта «${String(t.currency)}» не ISO 4217`);
    tariffs.push({
      exelyId: String(t.exelyId),
      name: String(t.name ?? ''),
      currency: t.currency,
      parentExelyId: t.parentExelyId == null ? null : String(t.parentExelyId),
    });
    for (const rt of t.roomTypes ?? []) {
      const where = `Тариф ${t.exelyId}, категория ${rt.exelyId}`;
      if (!/^\d+$/.test(String(rt.exelyId)))
        throw new ExelyImportError(
          `Тариф ${t.exelyId}: категория с некорректным ID «${String(rt.exelyId)}»`,
        );
      const seenOccupancy = new Set<number>();
      for (const pl of rt.placements ?? []) {
        const occupancy = OCCUPANCY_BY_PLACEMENT[pl.name];
        if (occupancy === undefined)
          throw new ExelyImportError(
            `${where}: размещение «${pl.name}» не поддерживается (ожидались «1 осн.» / «2 осн.»)`,
          );
        if (seenOccupancy.has(occupancy))
          throw new ExelyImportError(`${where}: размещение «${pl.name}» встречается дважды`);
        seenOccupancy.add(occupancy);
        const values = expand(
          expectRle(pl.prices, cal.daysCount, `${where}, ${pl.name}`),
          cal.daysCount,
        );
        values.forEach((v, i) => {
          if (v === null || v === '') return;
          dailyRates.push({
            date: dates[i]!,
            ratePlanExelyId: String(t.exelyId),
            accommodationTypeExelyId: String(rt.exelyId),
            occupancy,
            priceMinor: parsePrice(v, `${where}, ${pl.name}, ${dates[i]}`),
          });
        });
      }
      const expanded: Partial<Record<keyof typeof RESTRICTION_FIELDS, Array<string | null>>> = {};
      for (const [measure, rle] of Object.entries(rt.restrictions ?? {})) {
        const values = expand(expectRle(rle, cal.daysCount, `${where}, ${measure}`), cal.daysCount);
        if (measure in RESTRICTION_FIELDS) {
          expanded[measure as keyof typeof RESTRICTION_FIELDS] = values;
        } else if (values.some((v) => v !== null && v !== '')) {
          throw new ExelyImportError(
            `${where}: ограничение «${measure}» задано в Exely, но в модели Restriction его нет (DATA_MODEL §5)`,
          );
        }
      }
      dates.forEach((date, i) => {
        const row: RestrictionImportRow = {
          date,
          ratePlanExelyId: String(t.exelyId),
          accommodationTypeExelyId: String(rt.exelyId),
          minStay: parseIntOrNull(expanded.MinLOS?.[i] ?? null, `${where}, MinLOS, ${date}`),
          maxStay: parseIntOrNull(expanded.MaxLOS?.[i] ?? null, `${where}, MaxLOS, ${date}`),
          stopSell: parseFlag(expanded.StopSell?.[i] ?? null),
          closedToArrival: parseFlag(expanded.CTA?.[i] ?? null),
          closedToDeparture: parseFlag(expanded.CTD?.[i] ?? null),
        };
        if (
          row.minStay !== null ||
          row.maxStay !== null ||
          row.stopSell ||
          row.closedToArrival ||
          row.closedToDeparture
        )
          restrictions.push(row);
      });
    }
  }
  return {
    capturedAt: cal.capturedAt,
    period: { from: dates[0]!, to: dates[dates.length - 1]! },
    tariffs,
    dailyRates,
    restrictions,
  };
}
