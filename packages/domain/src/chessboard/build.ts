/**
 * Шахматка: ячейки × даты. Чистая функция, без БД (ADR-002: домен не знает про Prisma).
 * Правила: ночь — полуинтервал [start_date, end_date): день выезда ночь не занимает (AGENTS.md §13, DATA_MODEL §2).
 * Пересечение двух назначений на одной ячейке — ошибка данных (риск №6 PLAN.md: овербукинг), не «первая победила».
 */
import type { InventoryUnitKind } from '../inventory/types';

export type StayStatus =
  'TENTATIVE' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';
export type CellState = 'FREE' | 'OCCUPIED' | 'BLOCKED';

export interface ChessboardUnit {
  id: string;
  code: string;
  kind: InventoryUnitKind;
  accommodationTypeCode: string;
  accommodationTypeName: string;
}
export interface ChessboardAllocation {
  unitId: string;
  startDate: string;
  endDate: string;
  itemId: string;
  itemStatus: StayStatus;
  confirmationNumber: string;
  guestLabel: string;
}
export interface ChessboardBlock {
  unitId: string;
  dateFrom: string;
  dateTo: string;
  type: string;
  reason?: string | null;
}
export interface ChessboardInput {
  from: string;
  to: string;
  units: ChessboardUnit[];
  allocations: ChessboardAllocation[];
  blocks: ChessboardBlock[];
}
export interface ChessboardCell {
  date: string;
  state: CellState;
  itemId?: string;
  itemStatus?: StayStatus;
  confirmationNumber?: string;
  guestLabel?: string;
  /** дата = дата заезда проживания / дата = последняя ночь */
  isArrival?: boolean;
  isLastNight?: boolean;
  blockType?: string;
  blockReason?: string | null;
}
export interface ChessboardRow {
  unit: ChessboardUnit;
  cells: ChessboardCell[];
}
export interface DaySummary {
  occupied: number;
  blocked: number;
  free: number;
}
export interface CategoryDaySummary extends DaySummary {
  units: number;
}
export interface Chessboard {
  from: string;
  to: string;
  dates: string[];
  rows: ChessboardRow[];
  summary: Record<string, DaySummary>;
  byCategory: Record<string, Record<string, CategoryDaySummary>>;
}

export const MAX_CHESSBOARD_DAYS = 62;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const toUtc = (d: string) => new Date(`${d}T00:00:00Z`);
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: string, n: number) => {
  const x = toUtc(d);
  x.setUTCDate(x.getUTCDate() + n);
  return fmt(x);
};

/** Включительный список дат YYYY-MM-DD. */
export function dateRange(from: string, to: string): string[] {
  if (!ISO.test(from) || !ISO.test(to))
    throw new Error(`dateRange: даты должны быть YYYY-MM-DD, получено ${from}..${to}`);
  if (from > to) throw new Error(`dateRange: from ${from} позже to ${to}`);
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function buildChessboard(input: ChessboardInput): Chessboard {
  const dates = dateRange(input.from, input.to);
  if (dates.length > MAX_CHESSBOARD_DAYS) {
    throw new Error(
      `Шахматка: максимум ${MAX_CHESSBOARD_DAYS} дней за запрос, запрошено ${dates.length}`,
    );
  }
  const unitIndex = new Map(input.units.map((u, i) => [u.id, i]));
  const rows: ChessboardRow[] = input.units.map((unit) => ({
    unit,
    cells: dates.map((date) => ({ date, state: 'FREE' as CellState })),
  }));
  const dateIdx = new Map(dates.map((d, i) => [d, i]));

  for (const a of input.allocations) {
    const ri = unitIndex.get(a.unitId);
    if (ri === undefined) continue; // ячейка вне запрошенного фонда
    const lastNight = addDays(a.endDate, -1);
    for (let d = a.startDate; d < a.endDate; d = addDays(d, 1)) {
      const ci = dateIdx.get(d);
      if (ci === undefined) continue;
      const cell = rows[ri]!.cells[ci]!;
      if (cell.state === 'OCCUPIED') {
        throw new Error(
          `Пересечение назначений на ячейке ${rows[ri]!.unit.code} за ${d}: брони ${cell.confirmationNumber} и ${a.confirmationNumber}`,
        );
      }
      Object.assign(cell, {
        state: 'OCCUPIED',
        itemId: a.itemId,
        itemStatus: a.itemStatus,
        confirmationNumber: a.confirmationNumber,
        guestLabel: a.guestLabel,
        isArrival: d === a.startDate,
        isLastNight: d === lastNight,
      });
    }
  }
  for (const b of input.blocks) {
    const ri = unitIndex.get(b.unitId);
    if (ri === undefined) continue;
    for (let d = b.dateFrom; d < b.dateTo; d = addDays(d, 1)) {
      const ci = dateIdx.get(d);
      if (ci === undefined) continue;
      const cell = rows[ri]!.cells[ci]!;
      if (cell.state === 'FREE')
        Object.assign(cell, { state: 'BLOCKED', blockType: b.type, blockReason: b.reason ?? null });
    }
  }

  const summary: Record<string, DaySummary> = {};
  const byCategory: Record<string, Record<string, CategoryDaySummary>> = {};
  for (const [ci, date] of dates.entries()) {
    const day: DaySummary = { occupied: 0, blocked: 0, free: 0 };
    const cats: Record<string, CategoryDaySummary> = {};
    for (const row of rows) {
      const c =
        cats[row.unit.accommodationTypeCode] ??
        (cats[row.unit.accommodationTypeCode] = { units: 0, occupied: 0, blocked: 0, free: 0 });
      c.units += 1;
      const st = row.cells[ci]!.state;
      if (st === 'OCCUPIED') {
        day.occupied += 1;
        c.occupied += 1;
      } else if (st === 'BLOCKED') {
        day.blocked += 1;
        c.blocked += 1;
      } else {
        day.free += 1;
        c.free += 1;
      }
    }
    summary[date] = day;
    byCategory[date] = cats;
  }
  return { from: input.from, to: input.to, dates, rows, summary, byCategory };
}
