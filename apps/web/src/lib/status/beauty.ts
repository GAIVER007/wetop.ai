import type { StatusRegistry } from './types';

/**
 * Запись салона (`AppointmentStatus`). Слова приняты до DS1a и не переименовываются (решение владельца
 * №3): `label` из журнала и карточки записи, `groupLabel` из счётчиков аналитики салона.
 */
export type BeautyStatus = 'BOOKED' | 'CONFIRMED' | 'DONE' | 'NO_SHOW' | 'CANCELLED';

export const beautyStatus: StatusRegistry<BeautyStatus> = {
  BOOKED: { label: 'Записан', groupLabel: 'Запланировано', tone: 'info' },
  CONFIRMED: { label: 'Подтверждена', groupLabel: 'Подтверждено', tone: 'info' },
  DONE: { label: 'Завершена', groupLabel: 'Завершено', tone: 'success' },
  NO_SHOW: { label: 'Не пришёл', groupLabel: 'Не пришли', tone: 'danger' },
  CANCELLED: { label: 'Отменена', groupLabel: 'Отменено', tone: 'danger' },
};
