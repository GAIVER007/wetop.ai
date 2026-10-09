import type { AppointmentStatus } from '@pms/domain';
import type { StatusRegistry } from './types';

/**
 * Запись салона (`AppointmentStatus`). Слова приняты до DS1a и не переименовываются (решение владельца
 * №3): `label` из журнала и карточки записи, `groupLabel` из счётчиков аналитики салона.
 */
export const beautyStatus: StatusRegistry<AppointmentStatus> = {
  BOOKED: { label: 'Записан', groupLabel: 'Запланировано', tone: 'warning' },
  CONFIRMED: { label: 'Подтверждена', groupLabel: 'Подтверждено', tone: 'info' },
  DONE: { label: 'Завершена', groupLabel: 'Завершено', tone: 'neutral' },
  NO_SHOW: { label: 'Не пришёл', groupLabel: 'Не пришли', tone: 'danger' },
  CANCELLED: { label: 'Отменена', groupLabel: 'Отменено', tone: 'danger' },
};
