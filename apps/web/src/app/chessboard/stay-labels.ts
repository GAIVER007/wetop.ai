import type { ChessboardCell } from '../../lib/api';
import { SOURCES } from '../reservations/sources';
import { sourceStatus } from '../../lib/status/source';

/** Линейный проход: подпись на каждом видимом отрезке, включая проживание до начала окна. */
export function stayLabels(
  cells: ChessboardCell[],
): Array<{ index: number; span: number; continues: boolean }> {
  const labels: Array<{ index: number; span: number; continues: boolean }> = [];
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!;
    if (cell.state !== 'OCCUPIED' || !cell.itemId) continue;
    const index = i;
    while (
      i + 1 < cells.length &&
      cells[i + 1]!.state === 'OCCUPIED' &&
      cells[i + 1]!.itemId === cell.itemId &&
      cells[i + 1]!.itemStatus === cell.itemStatus
    )
      i++;
    labels.push({ index, span: i - index + 1, continues: !cell.isArrival });
  }
  return labels;
}

/** Только точные форматы служебных псевдонимов, в обоих порядках имени и фамилии. */
export function isGuestPseudonym(label: string): boolean {
  return /^(?:Гость\s+(?:Стойка|Канал)-[0-9a-f]{6}|(?:Стойка|Канал)-[0-9a-f]{6}\s+Гость)$/i.test(
    label.trim(),
  );
}

export function guestNames(
  label: string,
  source?: string,
  channel?: string | null,
): { full: string; short: string; initials: string } {
  if (isGuestPseudonym(label)) {
    // status-hint: откуда бронь без имени гостя, фраза для подписи плашки, а не имя источника
    const titles: Record<string, string> = {
      DESK: 'со стойки',
      WALK_IN: 'со стойки',
      PHONE: 'по телефону',
      WEBSITE: 'с сайта',
      WHATSAPP: 'из WhatsApp',
      INSTAGRAM: 'из Instagram',
      OTA: 'из канала',
    };
    const origin = channel ? `· ${channel}` : (titles[source ?? ''] ?? 'без имени');
    return {
      full: `Бронь ${origin}`,
      short:
        channel ??
        (titles[source ?? ''] ? origin.charAt(0).toUpperCase() + origin.slice(1) : 'Бронь'),
      initials: 'Бронь',
    };
  }
  const words = label.trim().split(/\s+/).filter(Boolean);
  const [first, second] = words;
  if (!first) return { full: '', short: '', initials: '' };
  const letter = (word: string) => word.charAt(0).toLocaleUpperCase('ru');
  return {
    full: words.join(' '),
    short: second ? `${first} ${letter(second)}.` : first,
    initials: letter(first) + (second ? letter(second) : ''),
  };
}

const CHANNEL_CODES: Record<string, string> = {
  'Booking.com': 'B',
  Agoda: 'A',
  'Trip.com': 'T',
  Expedia: 'E',
  Hostelworld: 'HW',
  'Ostrovok.ru': 'O',
  Ostrovok: 'O',
  'Bronevik.com': 'BR',
  OneTwoTrip: '12',
  Airbnb: 'AB',
};
/** Короткое имя прямого источника на плашке: из реестра `lib/status/source` (DS1a) */
const DIRECT_CODES: Record<string, string> = Object.fromEntries(
  Object.entries(sourceStatus).map(([k, s]) => [k, s.short ?? s.label]),
);

/**
 * Источник брони маленьким бейджем (ТЗ v2 §21): карточку не красим под канал — цвет занят статусом
 * (DESIGN.md §9). Коротко на плашке, полное имя — в подсказке и в предпросмотре.
 */
export function sourceBadge(
  source: string | undefined,
  channel: string | null | undefined,
): { code: string; name: string } | null {
  if (channel)
    return {
      code: CHANNEL_CODES[channel] ?? channel.charAt(0).toLocaleUpperCase('ru'),
      name: channel,
    };
  if (!source) return null;
  const name = SOURCES.find(([value]) => value === source)?.[1] ?? source;
  return { code: DIRECT_CODES[source] ?? name, name };
}
