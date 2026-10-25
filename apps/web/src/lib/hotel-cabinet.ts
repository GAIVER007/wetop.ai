/**
 * Кабинет горничной гостиницы (решение 22.10.2026): строка «Мой месяц» одной строкой (без плиток) и подписи срока
 * задачи словами, без ISO-дат. Чистые функции: их читают и сервер, и клиентский экран.
 */
import type { HotelStaffMonth, HotelStaffTask } from '@pms/domain';
import { countLabel, intlLocale, msg, translator, type DeskLocale, type Translate } from '../i18n';
import { displayDate } from './display-date';
import { portalMonthLabel } from './portal-month';

/** «Октябрь: 12 уборок, 3 задачи, 20 смен, 11 выходных» */
export function hotelMonthLine(
  m: HotelStaffMonth,
  currentYear: string,
  t: Translate = translator('ru'),
  locale: DeskLocale = 'ru',
): string {
  const count = (n: number, forms: [string, string, string]) => countLabel(locale, t, n, forms);
  return `${portalMonthLabel(m.month, currentYear, locale)}: ${[
    count(m.cleanings, [msg('уборка'), 'уборки', msg('уборок')]), // kk-allow: форма склонения
    count(m.tasksDone, [msg('задача'), 'задачи', msg('задач')]), // kk-allow: форма склонения
    count(m.shifts, [msg('смена'), 'смены', msg('смен')]), // kk-allow: форма склонения
    count(m.daysOff, [msg('выходной'), 'выходных', msg('выходных')]), // kk-allow: форма склонения
  ].join(', ')}`;
}

/** Срок задачи: «сегодня, 14:00», «просрочена с 20 окт.», «весь день» */
export function hotelTaskDue(
  task: Pick<HotelStaffTask, 'dueDate' | 'dueTime' | 'overdue' | 'done'>,
  today: string,
  t: Translate = translator('ru'),
  locale: DeskLocale = 'ru',
): string {
  const time = task.dueTime ?? t('весь день');
  if (task.done) return t('сделано');
  const date = displayDate(task.dueDate, 'short', intlLocale(locale));
  if (task.overdue) return t('просрочена с {date}', { date });
  return task.dueDate === today ? t('сегодня, {time}', { time }) : `${date}, ${time}`;
}

/** Кнопка уборки: «Убрано» только у грязного номера; у убранного подпись, что дальше */
export function hotelUnitNote(status: 'DIRTY' | 'CLEAN' | 'INSPECTED', cleanedToday: boolean): string {
  if (status === 'DIRTY') return msg('Нужно убрать');
  if (status === 'CLEAN') return cleanedToday ? msg('Убрано сегодня, ждёт проверки') : msg('Убрано, ждёт проверки');
  return msg('Проверено');
}
