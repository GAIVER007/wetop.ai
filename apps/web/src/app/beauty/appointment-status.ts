export { beautyLabels as STATUS_WORD } from '../../lib/status/beauty';
import type { BeautyAppointmentRow } from '../../lib/api';

export const ACTION_WORD: Record<BeautyAppointmentRow['status'], string> = {
  BOOKED: 'Вернуть в записанные',
  CONFIRMED: 'Подтвердить',
  DONE: 'Завершить',
  NO_SHOW: 'Не пришёл',
  CANCELLED: 'Отменить запись',
};
