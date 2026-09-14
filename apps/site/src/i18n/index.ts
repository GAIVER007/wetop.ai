import { ru } from './ru';
import type { Dictionary } from './types';

/*
 * Языки сайта. Сейчас только русский, переключателя нет. Чтобы добавить язык: словарь того же типа
 * (например, kk.ts), запись в `locales` и маршруты с префиксом языка; русский остаётся без префикса.
 */
export const locales = {
  ru: { dictionary: ru, htmlLang: 'ru', openGraphLocale: 'ru_RU', dateLocale: 'ru-RU' },
} as const satisfies Record<
  string,
  { dictionary: Dictionary; htmlLang: string; openGraphLocale: string; dateLocale: string }
>;

export type Locale = keyof typeof locales;

export const defaultLocale: Locale = 'ru';

export function getDictionary(locale: Locale = defaultLocale): Dictionary {
  return locales[locale].dictionary;
}

export function localeInfo(locale: Locale = defaultLocale) {
  return locales[locale];
}

export type { Dictionary } from './types';
