import type { IconName } from '../../components/icon';

/** Статус проживания словом и значком на полосе и в легенде (DESIGN.md §9): смысл не только цветом */
export const STAY_STATUS: Record<string, { word: string; icon: IconName; token: string }> = {
  TENTATIVE: { word: 'не подтверждена', icon: 'clock', token: 'tentative' },
  CONFIRMED: { word: 'ждём', icon: 'booking', token: 'confirmed' },
  CHECKED_IN: { word: 'заселён', icon: 'bed', token: 'checked-in' },
  CHECKED_OUT: { word: 'выехал', icon: 'departure', token: 'checked-out' },
};

/** Источник брони словом для бейджа: канал по имени, сайт — словом, стойка бейджа не получает */
export function sourceBadge(stay: { source?: string | undefined; channel?: string | null | undefined }): string | null {
  if (stay.channel) return stay.channel;
  if (stay.source === 'WEBSITE') return 'сайт';
  if (stay.source === 'OTA') return 'канал';
  return null;
}
