import { PHONE_COUNTRIES, type InterfaceLocale, type PhoneCountry } from './registration-contact';

/**
 * Страна по номеру телефона (владелец 29.10.2026): «пусть страна подтягивается по первым цифрам: +7 747/707 Казахстан,
 * +7 9xx Россия, +1 и так под каждую страну; по стране сразу предлагается язык системы». Человек вводит номер
 * целиком, форма показывает страну и язык; выбирать страну из списка не нужно.
 *
 * Правило:
 * - номер с «+» сравнивается с кодами всех стран, длинный код побеждает короткий (+971 раньше +97…, +1876 раньше +1);
 * - у «+7» две страны: после кода 6 или 7 это Казахстан (план нумерации РК: 6xx, 7xx), остальное Россия; пока цифры
 *   после +7 нет, страна предварительная: Казахстан (`sure: false`);
 * - местная запись «8 7xx…» и «8 9xx…» (11 цифр) читается как +7;
 * - без «+» и без 8 код не угадываем: «701…» может быть и номером, и кодом.
 * У «+1» США по умолчанию (Канада и Карибы делят зону, список кода их не различает).
 */
export interface PhoneMatch {
  code: string;
  name: string;
  dial: string;
  /** Цифры номера после кода страны */
  national: string;
  /** false, пока страну подсказывает только общий код (+7 без следующей цифры) */
  sure: boolean;
}

/** Пары [страна, код без «+»] всех стран списка: сторож полноты в тестах */
export const WORLD_DIALS: ReadonlyArray<readonly [string, string]> = PHONE_COUNTRIES.map((c) => [c.code, c.dial.slice(1)] as const);

/** Первая страна каждого кода: у общего кода (+7, +1) это основная (Казахстан, США) */
const BY_DIAL = new Map<string, PhoneCountry>();
for (const c of PHONE_COUNTRIES) if (!BY_DIAL.has(c.dial.slice(1))) BY_DIAL.set(c.dial.slice(1), c);
const DIALS = [...BY_DIAL.keys()].sort((a, b) => b.length - a.length);
const country = (code: string) => PHONE_COUNTRIES.find((c) => c.code === code)!;

export function countryFromPhone(raw: string): PhoneMatch | null {
  const text = raw.trim();
  let digits = text.replace(/\D/g, '');
  if (!text.startsWith('+')) {
    // местная запись +7: «8 701 …», «8 916 …» (11 цифр с 8 в начале)
    if (/^8[0-9]{10}$/.test(digits)) digits = '7' + digits.slice(1);
    else return null;
  }
  if (digits === '') return null;
  const dial = DIALS.find((d) => digits.startsWith(d));
  if (!dial) return null;
  const national = digits.slice(dial.length);
  if (dial === '7') {
    const first = national[0];
    const c = first === undefined || first === '6' || first === '7' ? country('KZ') : country('RU');
    return { code: c.code, name: c.name, dial: c.dial, national, sure: first !== undefined };
  }
  const c = BY_DIAL.get(dial)!;
  return { code: c.code, name: c.name, dial: c.dial, national, sure: true };
}

/** Страны, где кабинет по умолчанию на русском: Казахстан и СНГ (там русский понимают все) */
const RUSSIAN_FIRST = new Set(['KZ', 'RU', 'BY', 'KG', 'UZ', 'TJ', 'TM', 'AZ', 'AM', 'GE', 'MD', 'MN']);

/**
 * Язык системы по стране: Казахстан и СНГ русский, остальной мир английский. С `choices` порядок языков в списке:
 * для Казахстана казахский первым (государственный), затем русский и английский.
 */
export function suggestedLocale(code: string): InterfaceLocale;
export function suggestedLocale(code: string, mode: 'choices'): InterfaceLocale[];
export function suggestedLocale(code: string, mode?: 'choices'): InterfaceLocale | InterfaceLocale[] {
  const upper = code.toUpperCase();
  if (mode === 'choices') {
    if (upper === 'KZ') return ['kk', 'ru', 'en'];
    return RUSSIAN_FIRST.has(upper) ? ['ru', 'en', 'kk'] : ['en', 'ru', 'kk'];
  }
  return RUSSIAN_FIRST.has(upper) ? 'ru' : 'en';
}
