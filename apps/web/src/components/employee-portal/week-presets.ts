import { parseWorkingHoursWeek } from '@pms/domain';
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

const DAY_NAMES = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

/**
 * Проверка недели до отправки, словами по-русски (аудит живого сайта 21.10.2026, п. 2): пустое поле давало
 * подсказку браузера «Please fill out this field.», а рядом висело «Сохранено на сервере». Сначала пустое время
 * с названием дня, потом тот же разбор домена, что на сервере. null: неделю можно отправлять.
 */
export function weekProblem(
  days: ReadonlyArray<{ weekday: number; intervals: ReadonlyArray<{ timeFrom: string; timeTo: string }> }>,
): string | null {
  for (const day of days)
    for (const slot of day.intervals)
      if (!slot.timeFrom.trim() || !slot.timeTo.trim())
        return `${DAY_NAMES[day.weekday] ?? 'День'}: укажите время начала и конца, например 09:00 и 18:00`;
  const parsed = parseWorkingHoursWeek({
    intervals: days.flatMap((day) => day.intervals.map((slot) => ({ weekday: day.weekday, ...slot }))),
  });
  return parsed.ok ? null : parsed.reason;
}
