/** Быстрые шаблоны обычной недели мастера (онбординг 21.10.2026): одним нажатием, дальше правится по дню */
export interface WeekPreset {
  label: string;
  weekdays: readonly number[];
  timeFrom: string;
  timeTo: string;
}

export const WEEK_PRESETS: readonly WeekPreset[] = [
  { label: 'Пн-Пт 10:00-19:00', weekdays: [1, 2, 3, 4, 5], timeFrom: '10:00', timeTo: '19:00' },
  { label: 'Пн-Сб 10:00-20:00', weekdays: [1, 2, 3, 4, 5, 6], timeFrom: '10:00', timeTo: '20:00' },
  { label: 'Каждый день 09:00-21:00', weekdays: [0, 1, 2, 3, 4, 5, 6], timeFrom: '09:00', timeTo: '21:00' },
];

export function applyWeekPreset<D extends { weekday: number; intervals: Array<{ timeFrom: string; timeTo: string }> }>(
  days: readonly D[],
  preset: WeekPreset,
): D[] {
  return days.map((day) => ({
    ...day,
    intervals: preset.weekdays.includes(day.weekday) ? [{ timeFrom: preset.timeFrom, timeTo: preset.timeTo }] : [],
  }));
}
