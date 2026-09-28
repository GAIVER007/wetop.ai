/**
 * Шахматка: ячейки × даты. Чистая функция, без БД (ADR-002: домен не знает про Prisma).
 * Правила: ночь — полуинтервал [start_date, end_date): день выезда ночь не занимает (AGENTS.md §13, DATA_MODEL §2).
 * Пересечение двух назначений на одной ячейке — ошибка данных (риск №6 PLAN.md: овербукинг), не «первая победила».
 */
import type { InventoryUnitKind } from '../inventory/types';

export type StayStatus =
  'TENTATIVE' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';
export type CellState = 'FREE' | 'OCCUPIED' | 'BLOCKED';

export type HousekeepingStatus = 'DIRTY' | 'CLEAN' | 'INSPECTED';

export interface ChessboardUnit {
  id: string;
  code: string;
  kind: InventoryUnitKind;
  accommodationTypeCode: string;
  accommodationTypeName: string;
  /** Убрана ли ячейка (срез 7.1): приём из Exely «значок уборки у номера»; без значения бейджа нет */
  housekeepingStatus?: HousekeepingStatus;
  /**
   * Номер физической комнаты места (ТЗ «Шахматка v2» §17, подготовка к Q-095). Пока комнаты
   * импортированы 1:1 с местами, UI по ним не группирует — уровень «комната → одна койка» пуст.
   */
  physicalRoomNumber?: string;
}
export interface ChessboardAllocation {
  unitId: string;
  startDate: string;
  endDate: string;
  itemId: string;
  itemStatus: StayStatus;
  confirmationNumber: string;
  guestLabel: string;
  /** Откуда бронь: `OTA` с названием канала, `DESK`, `WEBSITE`… Каналы различаются словом, не цветом */
  source?: string;
  channel?: string | null;
  /** Остаток к оплате по счёту проживания, тиыны строкой (ADR-008); «0» — плашки суммы нет */
  balanceMinor?: string;
}
export interface ChessboardBlock {
  unitId: string;
  dateFrom: string;
  dateTo: string;
  type: string;
  reason?: string | null;
}
/**
 * Проживание без ячейки в диапазоне доски: бронь канала, которой не хватило места (Q-107), или бронь,
 * у которой назначение сняли. В Exely это строка «Без номера» под категорией. Гостей здесь нет — ПД.
 */
export interface UnassignedStay {
  confirmationNumber: string;
  categoryCode: string;
  categoryName: string;
  arrivalDate: string;
  departureDate: string;
  status: StayStatus;
}
export interface ChessboardInput {
  from: string;
  to: string;
  units: ChessboardUnit[];
  allocations: ChessboardAllocation[];
  blocks: ChessboardBlock[];
  /** Проживания без ячейки, пересекающие ночи доски; по умолчанию — ни одного */
  unassigned?: UnassignedStay[];
}
export interface ChessboardCell {
  date: string;
  state: CellState;
  itemId?: string;
  itemStatus?: StayStatus;
  confirmationNumber?: string;
  guestLabel?: string;
  /** Телефон заказчика для перехода в мессенджер из шахматки (T5) */
  guestPhone?: string | null;
  /** дата = дата заезда проживания / дата = последняя ночь */
  isArrival?: boolean;
  isLastNight?: boolean;
  /** Канал и долг проживания — чтобы не открывать карточку ради двух фактов (срез 7.1) */
  source?: string;
  channel?: string | null;
  balanceMinor?: string;
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
  /** Проживания без ячейки — по категории, затем по заезду; ячеек не занимают и в сводку не входят */
  unassigned: UnassignedStay[];
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

const DAY_MS = 86_400_000;

/**
 * Включительный список дат YYYY-MM-DD. Перебор идёт по миллисекундам, а не по строкам: после 9999-12-31 строка
 * становится «+010000-01», а она по строкам меньше «9999-12-31» — цикл по строкам не кончался (аудит 26.09, В-6).
 */
export function dateRange(from: string, to: string): string[] {
  if (!ISO.test(from) || !ISO.test(to))
    throw new Error(`dateRange: даты должны быть YYYY-MM-DD, получено ${from}..${to}`);
  if (from > to) throw new Error(`dateRange: from ${from} позже to ${to}`);
  const out: string[] = [];
  const end = toUtc(to).getTime();
  for (let t = toUtc(from).getTime(); t <= end; t += DAY_MS) out.push(fmt(new Date(t)));
  return out;
}

/** Сколько дат в `dateRange(from, to)` — без построения списка, чтобы проверять предел до работы. */
export function daySpan(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / DAY_MS) + 1;
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
  /**
   * Первая клетка доски для отрезка, начатого `start`: обходим только окно доски, а не весь отрезок. Блокировка до 9999
   * года обходилась день за днём — 2,9 млн шагов на каждую отрисовку (аудит 26.09, С-37). `undefined` — отрезок
   * начинается после доски.
   */
  const firstCell = (start: string): number | undefined =>
    start <= input.from ? 0 : dateIdx.get(start);

  for (const a of input.allocations) {
    const ri = unitIndex.get(a.unitId);
    if (ri === undefined) continue; // ячейка вне запрошенного фонда
    const lastNight = addDays(a.endDate, -1);
    const first = firstCell(a.startDate);
    if (first === undefined) continue;
    for (let ci = first; ci < dates.length && dates[ci]! < a.endDate; ci += 1) {
      const d = dates[ci]!;
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
        ...(a.source === undefined ? {} : { source: a.source }),
        ...(a.channel === undefined ? {} : { channel: a.channel }),
        ...(a.balanceMinor === undefined ? {} : { balanceMinor: a.balanceMinor }),
      });
    }
  }
  for (const b of input.blocks) {
    const ri = unitIndex.get(b.unitId);
    if (ri === undefined) continue;
    const first = firstCell(b.dateFrom);
    if (first === undefined) continue;
    for (let ci = first; ci < dates.length && dates[ci]! < b.dateTo; ci += 1) {
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
  const unassigned = [...(input.unassigned ?? [])].sort(
    (a, b) =>
      a.categoryCode.localeCompare(b.categoryCode) ||
      a.arrivalDate.localeCompare(b.arrivalDate) ||
      a.confirmationNumber.localeCompare(b.confirmationNumber),
  );
  return { from: input.from, to: input.to, dates, rows, summary, byCategory, unassigned };
}
