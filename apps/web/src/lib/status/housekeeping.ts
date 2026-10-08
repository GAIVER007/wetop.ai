import type { HousekeepingStatus } from '@pms/domain';
import type { StatusPresentation } from './types';

export const housekeeping = {
  DIRTY: { label: 'Требует уборки', tone: 'warning', icon: 'dirty' },
  CLEAN: { label: 'Убрано', tone: 'neutral', icon: 'clean' },
  INSPECTED: { label: 'Проверено', tone: 'success', icon: 'inspected' },
} as const satisfies Record<HousekeepingStatus, StatusPresentation>;
