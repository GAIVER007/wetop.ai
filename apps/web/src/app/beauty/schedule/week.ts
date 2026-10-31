/** Сетка графика (board.tsx): чистые расчёты недели, общие для страницы на сервере и сетки в браузере */

/** Часы нового рабочего дня, если у мастера ещё нет ни одного: обычный день салона */
export const DEFAULT_SLOT = { timeFrom: '09:00', timeTo: '18:00' };

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

/** Месяцы для выбора недели (31.10.2026): прошлый, текущий и пять вперёд; неделя месяца это неделя с его 1-м числом */
export function monthStarts(today: string): Array<{ month: string; monday: string }> {
  const [y, m] = today.split('-').map(Number) as [number, number];
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 2 + i, 1, 12));
    const first = d.toISOString().slice(0, 10);
    return { month: first.slice(0, 7), monday: mondayOf(first) };
  });
}
