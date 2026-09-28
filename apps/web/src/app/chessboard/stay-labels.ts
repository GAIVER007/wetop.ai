import type { ChessboardCell } from '../../lib/api';
import { SOURCES } from '../reservations/sources';

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

/** Имя гостя по ширине плашки (ТЗ v2 §18, §58): полное → «Имя Ф.» → инициалы; полное — всегда в подсказке */
export function guestNames(label: string): { full: string; short: string; initials: string } {
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
const DIRECT_CODES: Record<string, string> = {
  DESK: 'Стойка',
  WALK_IN: 'Стойка',
  PHONE: 'Тел.',
  WHATSAPP: 'WA',
  INSTAGRAM: 'IG',
  WEBSITE: 'Сайт',
  OTA: 'OTA',
};

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
