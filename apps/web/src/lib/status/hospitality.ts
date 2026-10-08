import type { ReservationStatus } from '@pms/domain';
import { statusLabels, type StatusPresentation } from './types';

interface HospitalityPresentation extends StatusPresentation {
  groupLabel: string;
  glyph: string;
  color: string;
}
export const hospitality = {
  TENTATIVE: {
    label: 'Не подтверждена',
    groupLabel: 'Не подтверждённые',
    tone: 'warning',
    glyph: '?',
    color: 'var(--st-tentative)',
  },
  CONFIRMED: {
    label: 'Подтверждена',
    groupLabel: 'Подтверждённые',
    tone: 'info',
    glyph: '•',
    color: 'var(--st-confirmed)',
  },
  CHECKED_IN: {
    label: 'Проживает',
    groupLabel: 'Проживают',
    tone: 'success',
    glyph: '✓',
    color: 'var(--st-checked-in)',
  },
  CHECKED_OUT: {
    label: 'Выехал',
    groupLabel: 'Выехавшие',
    tone: 'neutral',
    glyph: '✕',
    color: 'var(--st-checked-out)',
  },
  CANCELLED: {
    label: 'Отменена',
    groupLabel: 'Отменённые',
    tone: 'danger',
    glyph: '✕',
    color: 'var(--danger)',
  },
  NO_SHOW: {
    label: 'Незаезд',
    groupLabel: 'Незаезды',
    tone: 'danger',
    glyph: '✕',
    color: 'var(--danger)',
  },
} as const satisfies Record<ReservationStatus, HospitalityPresentation>;

export const hospitalityLabels = statusLabels(hospitality);
export const hospitalityWords = statusLabels(hospitality, true);
export const hospitalityGroups: Record<string, string> = Object.fromEntries(
  Object.entries(hospitality).map(([key, entry]) => [key, entry.groupLabel]),
);
export const hospitalityGlyphs: Record<string, string> = Object.fromEntries(
  Object.entries(hospitality).map(([key, entry]) => [key, entry.glyph]),
);
export const hospitalityColors: Record<string, string> = Object.fromEntries(
  Object.entries(hospitality).map(([key, entry]) => [key, entry.color]),
);
