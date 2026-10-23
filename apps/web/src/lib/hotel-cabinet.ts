/**
 * Кабинет горничной гостиницы (решение 22.10.2026): строка «Мой месяц» одной строкой (без плиток) и подписи срока
 * задачи словами, без ISO-дат. Чистые функции: их читают и сервер, и клиентский экран.
 */
import type { HotelStaffMonth, HotelStaffTask } from '@pms/domain';
import { displayDate } from './display-date';
import { pluralRu } from './plural';
import { portalMonthLabel } from './portal-month';

/** «Октябрь: 12 уборок, 3 задачи, 20 смен, 11 выходных» */
export function hotelMonthLine(m: HotelStaffMonth, currentYear: string): string {
  return `${portalMonthLabel(m.month, currentYear)}: ${[
    pluralRu(m.cleanings, ['уборка', 'уборки', 'уборок']),
    pluralRu(m.tasksDone, ['задача', 'задачи', 'задач']),
    pluralRu(m.shifts, ['смена', 'смены', 'смен']),
    pluralRu(m.daysOff, ['выходной', 'выходных', 'выходных']),
  ].join(', ')}`;
}

/** Срок задачи: «сегодня, 14:00», «просрочена с 20 окт.», «весь день» */
export function hotelTaskDue(t: Pick<HotelStaffTask, 'dueDate' | 'dueTime' | 'overdue' | 'done'>, today: string): string {
  const time = t.dueTime ?? 'весь день';
  if (t.done) return 'сделано';
  if (t.overdue) return `просрочена с ${displayDate(t.dueDate)}`;
  return t.dueDate === today ? `сегодня, ${time}` : `${displayDate(t.dueDate)}, ${time}`;
}

/** Кнопка уборки: «Убрано» только у грязного номера; у убранного подпись, что дальше */
export function hotelUnitNote(status: 'DIRTY' | 'CLEAN' | 'INSPECTED', cleanedToday: boolean): string {
  if (status === 'DIRTY') return 'Нужно убрать';
  if (status === 'CLEAN') return cleanedToday ? 'Убрано сегодня, ждёт проверки' : 'Убрано, ждёт проверки';
  return 'Проверено';
}
