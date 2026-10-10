import type { FoodStatus, OrderStatus } from '@pms/domain';
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

/** Заказ ресторана (`RestaurantOrderStatus`, §33.2): слова статусов с макета владельца (ADR-159) */
export const foodOrderStatus: StatusRegistry<OrderStatus> = {
  NEW: { label: 'Новый', groupLabel: 'Новые', tone: 'info' },
  COOKING: { label: 'Готовится', groupLabel: 'Готовятся', tone: 'warning' },
  READY: { label: 'Готово', groupLabel: 'Готово', tone: 'success' },
  SERVED: { label: 'Подан', groupLabel: 'Поданы', tone: 'neutral' },
  CLOSED: { label: 'Оплачен', groupLabel: 'Закрыты', tone: 'success' },
  CANCELLED: { label: 'Отменён', groupLabel: 'Отменены', tone: 'danger' },
};
