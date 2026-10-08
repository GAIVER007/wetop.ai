import type { FoodStatus } from '../food-types';
import { statusLabels, type StatusPresentation } from './types';

export const food = {
  BOOKED: { label: 'Бронь', tone: 'warning' },
  CONFIRMED: { label: 'Подтверждено', tone: 'info' },
  SEATED: { label: 'За столом', tone: 'success' },
  COMPLETED: { label: 'Завершено', tone: 'neutral' },
  NO_SHOW: { label: 'Не пришли', tone: 'danger' },
  CANCELLED: { label: 'Отменено', tone: 'neutral' },
} as const satisfies Record<FoodStatus, StatusPresentation>;
export const foodLabels = statusLabels(food);
