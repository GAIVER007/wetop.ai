import type { GuestDirectoryState } from '../../lib/api';

/**
 * Слово о госте и тон бейджа — одно на таблицу и панель предпросмотра (Гости v2, §15 ТЗ).
 * NONE — прочерк, бейджа нет: пустое значение — «—» (DESIGN.md §14).
 */
export const STATE_BADGE: Record<
  GuestDirectoryState,
  { word: string; tone: 'ok' | 'info' | 'neutral' } | null
> = {
  INHOUSE: { word: 'живёт', tone: 'ok' },
  EXPECTED: { word: 'ожидается', tone: 'info' },
  RECENT: { word: 'выехал недавно', tone: 'neutral' },
  NONE: null,
};
