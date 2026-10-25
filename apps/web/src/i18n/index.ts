import { kk } from './kk';

/**
 * Язык стойки (ADR-163, план `plans/desk-kk-2026-10-23.md`). Ключ перевода сам русский текст, как у gettext: реестр
 * меню, тексты экранов и тесты, сверяющие русские подписи, не меняются, а казахский словарь сопоставляет фразе
 * перевод. Фразы нет в словаре, значит русский: экран, ещё не переведённый целиком, остаётся русским, а не смесью.
 *
 * `en` в базе разрешён (`INTERFACE_LOCALES`), но перевода нет: стойка показывает его русским.
 */
export const DESK_LOCALES = ['ru', 'kk'] as const;
export type DeskLocale = (typeof DESK_LOCALES)[number];

/** Кука с языком для страниц без сессии и до ответа `/auth/me`; правда лежит в `users.locale` */
export const LOCALE_COOKIE = 'wetop_locale';

export const LOCALE_NAMES: Record<DeskLocale, string> = { ru: 'Русский', kk: 'Қазақша' };

export function deskLocale(raw: unknown): DeskLocale {
  return raw === 'kk' ? 'kk' : 'ru';
}

export type Vars = Record<string, string | number>;
export type Translate = (text: string, vars?: Vars) => string;

const fill = (text: string, vars?: Vars) =>
  vars ? text.replace(/\{(\w+)\}/g, (all, key: string) => (key in vars ? String(vars[key]) : all)) : text;

export function translator(locale: DeskLocale, dictionary: Record<string, string> = kk): Translate {
  return locale === 'kk' ? (text, vars) => fill(dictionary[text] ?? text, vars) : fill;
}

/**
 * Пометка «эта фраза переводится» для текста вне разметки: подписи статусов, колонок, варианты списков. Возвращает
 * фразу как есть, переводит её `t(…)` там, где она показывается. Сторож `kk-screens.test.ts` видит `msg('…')` как
 * переведённую фразу и требует её в словаре.
 */
export function msg<T extends string>(text: T): T {
  return text;
}

/** Локаль `Intl` для дат и чисел на языке человека: месяцы и дни недели по-казахски на казахском экране */
export function intlLocale(locale: DeskLocale): 'ru-RU' | 'kk-KZ' {
  return locale === 'kk' ? 'kk-KZ' : 'ru-RU';
}

/** Меню на языке человека: подписи разделов и пунктов. Права, адреса и подсветку решает русский реестр до перевода */
export function translateSections<S extends { label: string; items: Array<{ label: string }> }>(
  sections: S[],
  t: Translate,
): S[] {
  return sections.map((s) => ({ ...s, label: t(s.label), items: s.items.map((i) => ({ ...i, label: t(i.label) })) }));
}
