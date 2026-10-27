/**
 * Напоминание о закрытии смены (владелец 27.10.2026): за {@link CLOSE_REMINDER_MINUTES} минут до конца рабочего дня
 * филиала касса в шапке просит закрыть смену и сдать кассу; после конца, пока смена открыта, напоминание красное.
 * Конец рабочего дня считает сервер: самый поздний конец графиков сотрудников филиала на сегодня (`closesAt`).
 */
export const CLOSE_REMINDER_MINUTES = 30;

export type CloseReminder = { tone: 'soon' | 'late'; minutes: number } | null;

export function closeReminder(input: { shiftOpen: boolean; closesAt: string | null; now: Date }): CloseReminder {
  if (!input.shiftOpen || !input.closesAt) return null;
  const end = Date.parse(input.closesAt);
  if (Number.isNaN(end)) return null;
  const left = Math.round((end - input.now.getTime()) / 60_000);
  if (left > CLOSE_REMINDER_MINUTES) return null;
  return left > 0 ? { tone: 'soon', minutes: left } : { tone: 'late', minutes: Math.max(0, -left) };
}
