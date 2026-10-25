import type { BeautyAppointmentRow } from '../../lib/api';
import { msg } from '../../i18n';
/** status-hint: глагол кнопки перехода (что сделать), а не слово статуса; статусы в `lib/status/beauty` */
export const ACTION_WORD: Record<BeautyAppointmentRow['status'], string> = {
  BOOKED: msg('Вернуть в записанные'),
  CONFIRMED: msg('Подтвердить'),
  IN_PROGRESS: msg('Начать'),
  DONE: msg('Завершить'),
  NO_SHOW: msg('Не пришёл'),
  CANCELLED: msg('Отменить запись'),
};
