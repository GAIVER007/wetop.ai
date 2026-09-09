/**
 * Доступность категории для каналов продаж (DATA_MODEL §7): на каждую ночь
 * активные ячейки − заблокированные ячейки − проданные проживания (назначена ячейка или нет).
 * Не путать с «свободными ячейками» шахматки: проживание без ячейки здесь уже продано.
 */
import { dateRange } from '../chessboard/build';

export interface CategoryUnits {
  code: string;
  active: number;
}
export interface CategoryBlock {
  accommodationTypeCode: string;
  /** [dateFrom, dateTo) — ночи */
  dateFrom: string;
  dateTo: string;
}
export interface SoldItem {
  accommodationTypeCode: string;
  /** [arrivalDate, departureDate) — ночи */
  arrivalDate: string;
  departureDate: string;
}

export function categoryAvailability(input: {
  from: string;
  to: string;
  units: CategoryUnits[];
  blocks: CategoryBlock[];
  items: SoldItem[];
}): Map<string, Map<string, number>> {
  const dates = dateRange(input.from, input.to);
  const out = new Map<string, Map<string, number>>();
  for (const u of input.units) {
    const perDate = new Map<string, number>();
    for (const d of dates) {
      const blocked = input.blocks.filter(
        (b) => b.accommodationTypeCode === u.code && b.dateFrom <= d && d < b.dateTo,
      ).length;
      const sold = input.items.filter(
        (i) => i.accommodationTypeCode === u.code && i.arrivalDate <= d && d < i.departureDate,
      ).length;
      perDate.set(d, Math.max(0, u.active - blocked - sold));
    }
    out.set(u.code, perDate);
  }
  return out;
}
