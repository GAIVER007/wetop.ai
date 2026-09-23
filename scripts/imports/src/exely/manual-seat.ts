/**
 * Ручная посадка при переносе дат в Exely (Q-164, решение владельца 23.09.2026).
 *
 * Проживанию, которому Exely комнату не назначил, ячейку на шахматке выбирает стойка. Когда в Exely потом
 * двигают даты, импорт переписывал срок проживания, а назначение оставалось на старых ночах: гость стоял на
 * шахматке не те ночи, освободившаяся койка продавалась ещё раз. Теперь посадка следует за новым сроком.
 * Чистая функция — без БД: свободна ли ячейка на новые ночи, проверяет импорт.
 */
export interface SeatSegment {
  unitId: string;
  /** Первая ночь, YYYY-MM-DD */
  start: string;
  /** Дата выезда (последняя ночь — накануне), YYYY-MM-DD */
  end: string;
}

/**
 * Посадка на новый срок [start, end).
 * - Одна ячейка — весь новый срок на ней.
 * - Переезд внутри срока (ячеек несколько) — края подрезаются под новый срок; стал длиннее — первая ячейка
 *   продлевается назад, последняя вперёд.
 * - null — следовать не за чем: посадки нет, срок пустой, или ячеек несколько, а новый срок со старым не
 *   пересекается (за какой из них идти, непонятно). Тогда импорт снимает посадку и пишет «без ячейки».
 */
export function followNewDates(
  current: readonly SeatSegment[],
  start: string,
  end: string,
): SeatSegment[] | null {
  if (current.length === 0 || start >= end) return null;
  const sorted = [...current].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  if (new Set(sorted.map((s) => s.unitId)).size === 1) return [{ unitId: sorted[0]!.unitId, start, end }];
  const clipped = sorted
    .map((s) => ({
      unitId: s.unitId,
      start: s.start > start ? s.start : start,
      end: s.end < end ? s.end : end,
    }))
    .filter((s) => s.start < s.end);
  if (clipped.length === 0) return null;
  clipped[0] = { ...clipped[0]!, start };
  clipped[clipped.length - 1] = { ...clipped[clipped.length - 1]!, end };
  return clipped;
}
