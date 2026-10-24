import { beautyApi, type BeautyReminderItem } from './api';

/**
 * Напоминания клиентам на сегодня для блока «Напомнить сегодня» в журнале (решение 21.10.2026 §1).
 * Только «Вручную» и «Ошибка»: остальное уходит само. Сбой загрузки не ломает журнал: блока просто нет.
 */
export async function loadManualReminders(): Promise<{ timezone: string; items: BeautyReminderItem[] } | null> {
  try {
    const day = await beautyApi.reminders();
    return { timezone: day.timezone, items: day.items.filter((item) => item.state === 'MANUAL' || item.state === 'FAILED') };
  } catch {
    return null;
  }
}
