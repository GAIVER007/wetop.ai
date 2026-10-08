import type { StatusRegistry } from './types';

/** Бронь и проживание гостиницы (`ReservationStatus`). Слова, группы и тона утвердил владелец 08.10. */
export type HospitalityStatus =
  'TENTATIVE' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';

export const hospitalityStatus: StatusRegistry<HospitalityStatus> = {
  TENTATIVE: { label: 'Не подтверждена', groupLabel: 'Не подтверждённые', tone: 'warning' },
  CONFIRMED: { label: 'Подтверждена', groupLabel: 'Подтверждённые', tone: 'info' },
  CHECKED_IN: { label: 'Проживает', groupLabel: 'Проживают', tone: 'success' },
  CHECKED_OUT: { label: 'Выехал', groupLabel: 'Выехавшие', tone: 'neutral' },
  CANCELLED: { label: 'Отменена', groupLabel: 'Отменённые', tone: 'danger' },
  NO_SHOW: { label: 'Незаезд', groupLabel: 'Незаезды', tone: 'danger' },
};
