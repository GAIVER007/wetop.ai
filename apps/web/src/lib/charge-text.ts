import { intlLocale, type DeskLocale } from '../i18n';
import { displayDate, displayDay } from './display-date';

/**
 * Описание начисления приходит из API с датами ISO («Проживание 2026-10-22 → 2026-10-24», так оно записано в
 * базе и в старых счетах). Человек видит «22 окт. – 24 окт.» на экране и «22.10.2026 – 24.10.2026» на печати
 * (аудит гостиницы 22.10.2026 P1-7, P1-8). Хранимый текст не меняется: только представление.
 */
export type DateStyle = 'screen' | 'print';

/** `locale` даёт месяц на экране на языке человека; печать числовая и от языка не зависит */
const day = (iso: string, style: DateStyle, locale: DeskLocale) =>
  style === 'print' ? displayDay(iso) : displayDate(iso, 'short', intlLocale(locale));

export function stayRangeText(from: string, to: string, style: DateStyle, locale: DeskLocale = 'ru'): string {
  return `${day(from, style, locale)} – ${day(to, style, locale)}`;
}

const RANGE = /(\d{4}-\d{2}-\d{2})\s*(?:→|->|–|—)\s*(\d{4}-\d{2}-\d{2})/g;
const SINGLE = /\b(\d{4}-\d{2}-\d{2})\b/g;

export function humanizeIsoDates(text: string, style: DateStyle, locale: DeskLocale = 'ru'): string {
  return text
    .replace(RANGE, (_m, a: string, b: string) => stayRangeText(a, b, style, locale))
    .replace(SINGLE, (_m, a: string) => day(a, style, locale));
}

/**
 * Вид начисления подписью перед описанием, если описание само его не называет: «проживание Проживание …»
 * превращается в «Проживание 22 окт. – 24 окт.» без повтора.
 */
export function chargeLine(
  kindLabel: string | null,
  description: string,
  style: DateStyle = 'screen',
  locale: DeskLocale = 'ru',
): { kind: string | null; text: string } {
  const text = humanizeIsoDates(description, style, locale);
  const repeats =
    !!kindLabel && text.toLocaleLowerCase('ru').startsWith(kindLabel.toLocaleLowerCase('ru'));
  return { kind: repeats ? null : kindLabel, text };
}
