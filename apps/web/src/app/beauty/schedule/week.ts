import type { BeautyWeekDay, BeautyWorkingInterval } from '../../../lib/api';

/** Сетка графика (board.tsx): чистые расчёты недели, общие для страницы на сервере и сетки в браузере */

/** Часы нового рабочего дня, если у мастера ещё нет ни одного: обычный день салона */
export const DEFAULT_SLOT = { timeFrom: '09:00', timeTo: '18:00' };

/** Неделя после переключения дня: включённый день получает часы первого рабочего дня мастера */
export function toggleWeekday(
  week: BeautyWeekDay[],
  weekday: number,
  on: boolean,
): BeautyWorkingInterval[] {
  const template = week.find((d) => d.intervals.length)?.intervals ?? [DEFAULT_SLOT];
  return week.flatMap((d) =>
    (d.weekday === weekday ? (on ? template : []) : d.intervals).map((s) => ({
      weekday: d.weekday,
      timeFrom: s.timeFrom,
      timeTo: s.timeTo,
    })),
  );
}

/** Семь дат недели от понедельника: календарные даты, без поясов (полдень UTC не съезжает) */
export function weekDates(monday: string): Array<{ date: string; weekday: number }> {
  const start = Date.parse(`${monday}T12:00:00Z`);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start + i * 86_400_000);
    return { date: d.toISOString().slice(0, 10), weekday: d.getUTCDay() };
  });
}

/** Понедельник соседней недели */
export function shiftWeek(monday: string, days: number): string {
  return new Date(Date.parse(`${monday}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Понедельник недели, в которую попадает дата */
export function mondayOf(date: string): string {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return shiftWeek(date, -((day + 6) % 7));
}
