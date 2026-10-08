import type { AppointmentStatus } from '@pms/domain';
import { statusLabels, type StatusPresentation } from './types';

export const beauty = {
  BOOKED: { label: 'Записан', tone: 'warning' },
  CONFIRMED: { label: 'Подтверждена', tone: 'info' },
  DONE: { label: 'Завершена', tone: 'success' },
  NO_SHOW: { label: 'Не пришёл', tone: 'danger' },
  CANCELLED: { label: 'Отменена', tone: 'neutral' },
} as const satisfies Record<AppointmentStatus, StatusPresentation>;
export const beautyLabels = statusLabels(beauty);
