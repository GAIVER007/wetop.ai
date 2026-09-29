/**
 * Ближайшая доступность для экрана «Свободные места» (ADR-110, ТЗ §7, шаг AV4): «с 1-го нет, но есть с 3-го».
 * Своего правила нет: тот же срок сдвигается вперёд по дню, и каждое окно считается так же, как
 * `GET /availability` — `sellableStay`. Глубина поиска — параметр интерфейса, не бизнес-правило (ТЗ §7).
 */
import type { ChessboardAllocation, ChessboardBlock, ChessboardUnit } from '../chessboard/index';
import { availableUnitsForStay, capStayAvailability, type StayAvailability } from './availability';
import { categoryAvailability, type SoldItem } from './category';

/** Глубина поиска по умолчанию — дней вперёд от запрошенного заезда */
export const NEAREST_DAYS_DEFAULT = 14;

export interface StaySources {
  units: ChessboardUnit[];
  allocations: ChessboardAllocation[];
  blocks: ChessboardBlock[];
  /** Проданные проживания категории — с ячейкой и без (Q-107) */
  sold: SoldItem[];
}

const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

/**
 * Сколько можно продать на проживание [arrival, departure): ячейки, свободные каждую ночь, но не больше остатка
 * канала за худшую ночь (Q-107). Ровно это отдаёт стойке `GET /availability`.
 */
export function sellableStay(
  input: StaySources & { arrivalDate: string; departureDate: string },
): StayAvailability {
  const stay = availableUnitsForStay({
    arrivalDate: input.arrivalDate,
    departureDate: input.departureDate,
    units: input.units,
    allocations: input.allocations,
    blocks: input.blocks,
  });
  const unitCategory = new Map(input.units.map((u) => [u.id, u.accommodationTypeCode]));
  const active = new Map<string, number>();
  for (const u of input.units)
    active.set(u.accommodationTypeCode, (active.get(u.accommodationTypeCode) ?? 0) + 1);
  const perNight = categoryAvailability({
    from: input.arrivalDate,
    to: addDays(input.departureDate, -1),
    units: [...active].map(([code, count]) => ({ code, active: count })),
    blocks: input.blocks.map((b) => ({
      accommodationTypeCode: unitCategory.get(b.unitId) ?? '',
      dateFrom: b.dateFrom,
      dateTo: b.dateTo,
    })),
    items: input.sold,
  });
  return capStayAvailability(stay, perNight);
}

export type NearestStay = { arrivalDate: string; departureDate: string } | null;

/**
 * Для каждой категории из `need` (сколько мест нужно запросу: номер — один, койки — по одной на гостя) — первое
 * окно того же срока с заездом от `arrivalDate` до `arrivalDate + days`, где продать можно не меньше `need`.
 * Запрошенные даты тоже окно: категория со свободными местами получает их же. Не нашлось — null.
 */
export function nearestAvailability(
  input: StaySources & {
    arrivalDate: string;
    departureDate: string;
    days: number;
    need: Record<string, number>;
  },
): Record<string, NearestStay> {
  const out: Record<string, NearestStay> = {};
  const pending = new Set(Object.keys(input.need));
  for (let shift = 0; shift <= input.days && pending.size; shift += 1) {
    const arrivalDate = addDays(input.arrivalDate, shift);
    const departureDate = addDays(input.departureDate, shift);
    const window = sellableStay({ ...input, arrivalDate, departureDate });
    for (const code of [...pending])
      if ((window.byCategory[code]?.available ?? 0) >= input.need[code]!) {
        out[code] = { arrivalDate, departureDate };
        pending.delete(code);
      }
  }
  for (const code of pending) out[code] = null;
  return out;
}
