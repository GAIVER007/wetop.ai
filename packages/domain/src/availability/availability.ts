/**
 * Доступность ячеек для проживания [arrival, departure): ячейка подходит, только если свободна КАЖДУЮ ночь
 * и не заблокирована. Это число уходит в Channex как availability по категории (docs/channex/how-channex-works-for-us.md §2).
 * Чистая функция поверх buildChessboard; итоговую гарантию от овербукинга даёт БД (exclusion constraint).
 */
import { buildChessboard, type ChessboardInput } from '../chessboard/index';

export interface StayAvailabilityInput extends Omit<ChessboardInput, 'from' | 'to'> {
  arrivalDate: string;
  departureDate: string;
}
export interface CategoryAvailability {
  units: number;
  available: number;
  availableUnitCodes: string[];
}
export interface StayAvailability {
  arrivalDate: string;
  departureDate: string;
  nights: number;
  total: { units: number; available: number };
  byCategory: Record<string, CategoryAvailability>;
}

const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

/**
 * Q-107 (11.09.2026): остаток категории на стойке не может быть больше, чем у канала.
 * Канал считает проданные проживания, включая брони без ячейки (`categoryAvailability`); шахматка —
 * свободные ячейки. Бронь без ячейки для канала уже продана, а стойка её не видела и показывала мест
 * больше, чем можно продать. Поэтому «свободно» = min(свободных ячеек, остаток канала за худшую ночь).
 * Список ячеек не режется: это выбор места, а не право продать.
 */
export function capStayAvailability(
  stay: StayAvailability,
  perNightByCategory: Map<string, Map<string, number>>,
): StayAvailability {
  const byCategory: Record<string, CategoryAvailability> = {};
  let available = 0;
  for (const [code, cat] of Object.entries(stay.byCategory)) {
    const nights = perNightByCategory.get(code);
    const channel = nights && nights.size ? Math.min(...nights.values()) : cat.available;
    const capped = { ...cat, available: Math.min(cat.available, Math.max(0, channel)) };
    byCategory[code] = capped;
    available += capped.available;
  }
  return { ...stay, total: { ...stay.total, available }, byCategory };
}

export function availableUnitsForStay(input: StayAvailabilityInput): StayAvailability {
  if (input.departureDate <= input.arrivalDate) {
    throw new Error(
      `Проживание должно содержать хотя бы одну ночь: заезд ${input.arrivalDate}, выезд ${input.departureDate}`,
    );
  }
  const lastNight = addDays(input.departureDate, -1);
  const board = buildChessboard({ ...input, from: input.arrivalDate, to: lastNight });
  const byCategory: Record<string, CategoryAvailability> = {};
  let available = 0;
  for (const row of board.rows) {
    const cat =
      byCategory[row.unit.accommodationTypeCode] ??
      (byCategory[row.unit.accommodationTypeCode] = {
        units: 0,
        available: 0,
        availableUnitCodes: [],
      });
    cat.units += 1;
    if (row.cells.every((c) => c.state === 'FREE')) {
      cat.available += 1;
      cat.availableUnitCodes.push(row.unit.code);
      available += 1;
    }
  }
  return {
    arrivalDate: input.arrivalDate,
    departureDate: input.departureDate,
    nights: board.dates.length,
    total: { units: board.rows.length, available },
    byCategory,
  };
}
