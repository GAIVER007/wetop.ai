import type { StatusRegistry } from './types';

/**
 * Уборка места (`HousekeepingStatus`). Только статусы; пояснения вроде «убрана, ждёт проверки» живут
 * у своего действия или экрана (решение владельца 08.10).
 */
export type HousekeepingStatus = 'DIRTY' | 'CLEAN' | 'INSPECTED';

export const housekeepingStatus = {
  DIRTY: { label: 'Требует уборки', tone: 'warning', icon: 'dirty' },
  CLEAN: { label: 'Убрано', tone: 'info', icon: 'clean' },
  INSPECTED: { label: 'Проверено', tone: 'success', icon: 'inspected' },
} as const satisfies StatusRegistry<HousekeepingStatus>;
