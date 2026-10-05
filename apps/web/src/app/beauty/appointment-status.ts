import type { BeautyAppointmentRow } from '../../lib/api';
export const STATUS_WORD: Record<BeautyAppointmentRow['status'], string> = {
  BOOKED: 'Записан',
  CONFIRMED: 'Подтверждена',
  DONE: 'Завершена',
  NO_SHOW: 'Не пришёл',
  CANCELLED: 'Отменена',
};

export const ACTION_WORD: Record<BeautyAppointmentRow['status'], string> = {
  BOOKED: 'Вернуть в записанные',
  CONFIRMED: 'Подтвердить',
  DONE: 'Завершить',
  NO_SHOW: 'Не пришёл',
  CANCELLED: 'Отменить запись',
};
