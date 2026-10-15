import type { BeautyAppointmentRow } from '../../lib/api';
/** status-hint: глагол кнопки перехода (что сделать), а не слово статуса; статусы в `lib/status/beauty` */
export const ACTION_WORD: Record<BeautyAppointmentRow['status'], string> = {
  BOOKED: 'Вернуть в записанные',
  CONFIRMED: 'Подтвердить',
  DONE: 'Завершить',
  NO_SHOW: 'Не пришёл',
  CANCELLED: 'Отменить запись',
};
