import type { FoodStatus } from '@pms/domain';
import type { StatusRegistry } from './types';

/**
 * Бронь стола ресторана (`RestaurantReservationStatus`). Слова приняты до DS1a и не переименовываются
 * (решение владельца №3): `label` из зала и панели брони, `groupLabel` из счётчиков аналитики.
 */
export const foodStatus: StatusRegistry<FoodStatus> = {
  BOOKED: { label: 'Бронь', groupLabel: 'Запланировано', tone: 'warning' },
  CONFIRMED: { label: 'Подтверждено', groupLabel: 'Подтверждено', tone: 'info' },
  SEATED: { label: 'За столом', groupLabel: 'Посажены', tone: 'success' },
  COMPLETED: { label: 'Завершено', groupLabel: 'Завершено', tone: 'neutral' },
  NO_SHOW: { label: 'Не пришли', groupLabel: 'Не пришли', tone: 'danger' },
  CANCELLED: { label: 'Отменено', groupLabel: 'Отменено', tone: 'danger' },
};
