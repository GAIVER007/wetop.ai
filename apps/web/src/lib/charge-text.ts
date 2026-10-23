import { displayDate, displayDay } from './display-date';

/**
 * Описание начисления приходит из API с датами ISO («Проживание 2026-10-22 → 2026-10-24», так оно записано в
 * базе и в старых счетах). Человек видит «22 окт. – 24 окт.» на экране и «22.10.2026 – 24.10.2026» на печати
 * (аудит гостиницы 22.10.2026 P1-7, P1-8). Хранимый текст не меняется: только представление.
 */
export type DateStyle = 'screen' | 'print';

const day = (iso: string, style: DateStyle) =>
  style === 'print' ? displayDay(iso) : displayDate(iso, 'short');

export function stayRangeText(from: string, to: string, style: DateStyle): string {
  return `${day(from, style)} – ${day(to, style)}`;
}

const RANGE = /(\d{4}-\d{2}-\d{2})\s*(?:→|->|–|—)\s*(\d{4}-\d{2}-\d{2})/g;
const SINGLE = /\b(\d{4}-\d{2}-\d{2})\b/g;

export function humanizeIsoDates(text: string, style: DateStyle): string {
  return text
    .replace(RANGE, (_m, a: string, b: string) => stayRangeText(a, b, style))
    .replace(SINGLE, (_m, a: string) => day(a, style));
}

/**
 * Вид начисления подписью перед описанием, если описание само его не называет: «проживание Проживание …»
 * превращается в «Проживание 22 окт. – 24 окт.» без повтора.
 */
export function chargeLine(
  kindLabel: string | null,
  description: string,
  style: DateStyle = 'screen',
): { kind: string | null; text: string } {
  const text = humanizeIsoDates(description, style);
  const repeats =
    !!kindLabel && text.toLocaleLowerCase('ru').startsWith(kindLabel.toLocaleLowerCase('ru'));
  return { kind: repeats ? null : kindLabel, text };
}
