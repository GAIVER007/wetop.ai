/**
 * Сутки внутри PMS: числа дня против шахматки против карточек (ADR-052).
 *
 * До 20.09.2026 вечернюю проверку делал `cli-double-entry.ts` — он сверял сутки с Legacy. Legacy больше не
 * источник, сверять не с чем, и сам скрипт без `LEGACY_API_KEY` не запускается. Проверять теперь надо не
 * совпадение двух систем, а внутреннюю связность одной: то, что «Главная» показывает смене, должно
 * держаться на тех же проживаниях, что стоят на шахматке, и на тех же карточках.
 *
 * Здесь только сравнение — чистая функция без сети, чтобы её можно было проверить тестами.
 */
import type { Chessboard } from '@pms/domain';

export interface DayRow {
  confirmationNumber: string;
  unitCode: string | null;
  accommodationTypeName: string;
  status: string;
}
export interface DaySnapshot {
  date: string;
  inHouse: DayRow[];
  arrivals: DayRow[];
  departures: DayRow[];
  counts: { arrivals: number; departures: number; inHouse: number };
}
export interface BoardSnapshot {
  /** Коды ячеек, занятых в эту ночь, по номеру брони */
  occupiedByNumber: Record<string, string[]>;
  /** Проживания без ячейки на эту дату */
  unassigned: Array<{ confirmationNumber: string; categoryName: string }>;
  /** Сумма occupied по категориям на эту дату */
  occupiedCells: number;
}

export type Finding = { level: 'fail' | 'warn'; what: string };

/**
 * Ответ `/chessboard` за одну дату → то, что сравнивает `checkDay`. Тип — из домена, а не свой: своя копия читала у
 * клетки поле `stay`, которого в ответе нет, и каждый заселённый выходил ложным FAIL (аудит 26.09, С-73).
 */
export function boardSnapshot(raw: Chessboard, date: string): BoardSnapshot {
  const occupiedByNumber: Record<string, string[]> = {};
  for (const r of raw.rows) {
    for (const c of r.cells) {
      if (c.date !== date || c.state !== 'OCCUPIED' || !c.confirmationNumber) continue;
      (occupiedByNumber[c.confirmationNumber] ??= []).push(r.unit.code);
    }
  }
  return {
    occupiedByNumber,
    unassigned: raw.unassigned
      .filter((u) => u.arrivalDate <= date && date < u.departureDate)
      .map((u) => ({ confirmationNumber: u.confirmationNumber, categoryName: u.categoryName })),
    occupiedCells: Object.values(raw.byCategory[date] ?? {}).reduce((s, c) => s + c.occupied, 0),
  };
}

/**
 * Правила, и каждое — про ошибку, которую смена увидит как «система врёт»:
 *  1. счётчики «Главной» должны совпадать с длиной своих же списков;
 *  2. заселённый на «Главной» обязан стоять на шахматке — иначе койка продаётся дважды;
 *  3. ячейка в списке дня и ячейка на шахматке должны быть одной и той же;
 *  4. проживание без ячейки — не ошибка данных, но это работа смены на сегодня (предупреждение);
 *  5. занятых клеток на доске не может быть меньше, чем заселённых с ячейкой.
 */
export function checkDay(day: DaySnapshot, board: BoardSnapshot): Finding[] {
  const out: Finding[] = [];
  const pair: Array<[keyof DaySnapshot['counts'], DayRow[]]> = [
    ['arrivals', day.arrivals],
    ['departures', day.departures],
    ['inHouse', day.inHouse],
  ];
  for (const [name, list] of pair) {
    if (day.counts[name] !== list.length) {
      out.push({ level: 'fail', what: `счётчик ${name}: ${day.counts[name]}, а в списке ${list.length}` });
    }
  }

  const unassigned = new Set(board.unassigned.map((u) => u.confirmationNumber));
  let settledWithUnit = 0;
  for (const row of day.inHouse) {
    const onBoard = board.occupiedByNumber[row.confirmationNumber];
    if (row.unitCode) settledWithUnit += 1;
    if (!onBoard || onBoard.length === 0) {
      if (unassigned.has(row.confirmationNumber)) {
        out.push({ level: 'warn', what: `${row.confirmationNumber}: проживает без ячейки — посадить на шахматке` });
      } else {
        out.push({ level: 'fail', what: `${row.confirmationNumber}: проживает по «Главной», но на шахматке его нет` });
      }
      continue;
    }
    if (row.unitCode && !onBoard.includes(row.unitCode)) {
      out.push({
        level: 'fail',
        what: `${row.confirmationNumber}: на «Главной» ячейка ${row.unitCode}, на шахматке ${onBoard.join(', ')}`,
      });
    }
  }

  if (board.occupiedCells < settledWithUnit) {
    out.push({
      level: 'fail',
      what: `занятых клеток на шахматке ${board.occupiedCells}, а заселённых с ячейкой ${settledWithUnit}`,
    });
  }
  return out;
}

export function verdict(findings: Finding[]): string {
  const fails = findings.filter((f) => f.level === 'fail').length;
  const warns = findings.length - fails;
  if (fails > 0) return `RESULT: FAIL — расхождений ${fails}${warns ? `, предупреждений ${warns}` : ''}`;
  if (warns > 0) return `RESULT: OK с предупреждениями — ${warns}`;
  return 'RESULT: OK — сутки внутри PMS сходятся';
}
