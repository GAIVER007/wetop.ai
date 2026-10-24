import { kk } from './kk';
import { en } from './en';
import { pluralRu } from '../lib/plural';

const DICTIONARIES: Record<Exclude<DeskLocale, 'ru'>, Record<string, string>> = { kk, en };

/**
 * Язык стойки (ADR-163, план `plans/desk-kk-2026-10-23.md`). Ключ перевода сам русский текст, как у gettext: реестр
 * меню, тексты экранов и тесты, сверяющие русские подписи, не меняются, а казахский словарь сопоставляет фразе
 * перевод. Фразы нет в словаре, значит русский: экран, ещё не переведённый целиком, остаётся русским, а не смесью.
 *
 * EN1 (24.10.2026): английский третьим языком, словарь `en.ts` с теми же ключами. Фразы нет в словаре языка, значит русский.
 */
export const DESK_LOCALES = ['ru', 'kk', 'en'] as const;
export type DeskLocale = (typeof DESK_LOCALES)[number];

/** Кука с языком для страниц без сессии и до ответа `/auth/me`; правда лежит в `users.locale` */
export const LOCALE_COOKIE = 'wetop_locale';

export const LOCALE_NAMES: Record<DeskLocale, string> = { ru: 'Русский', kk: 'Қазақша', en: 'English' };

export function deskLocale(raw: unknown): DeskLocale {
  return raw === 'kk' || raw === 'en' ? raw : 'ru';
}

export type Vars = Record<string, string | number>;
export type Translate = (text: string, vars?: Vars) => string;

const fill = (text: string, vars?: Vars) =>
  vars ? text.replace(/\{(\w+)\}/g, (all, key: string) => (key in vars ? String(vars[key]) : all)) : text;

/**
 * Контекст многозначной фразы: `t('Вернуть@@деньги')` на русском экране показывает «Вернуть», а словари переводят её
 * отдельно от «Вернуть» версии сайта (Refund и Restore). Без контекста одна русская фраза получает один перевод везде.
 */
const plain = (text: string) => text.replace(/@@[^@]*$/, '');

export function translator(locale: DeskLocale, dictionary?: Record<string, string>): Translate {
  if (locale === 'ru') return (text, vars) => fill(plain(text), vars);
  const words = dictionary ?? DICTIONARIES[locale];
  return (text, vars) => fill(words[text] ?? plain(text), vars);
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
export function intlLocale(locale: DeskLocale): 'ru-RU' | 'kk-KZ' | 'en-GB' {
  return locale === 'kk' ? 'kk-KZ' : locale === 'en' ? 'en-GB' : 'ru-RU';
}

/**
 * Число со словом на языке человека (EN1). Формы как у `pluralRu` («день», «дня», «дней»): русский склоняет, казахский
 * берёт перевод первой формы при любом числе («5 күн»), английский первой для 1 и третьей для остальных («21 days»).
 * Первую и третью форму размечайте `msg('…')`, чтобы сторож требовал их перевод.
 */
export function countLabel(locale: DeskLocale, t: Translate, n: number, forms: [string, string, string]): string {
  if (locale === 'ru') return pluralRu(n, forms.map(plain) as [string, string, string]);
  if (locale === 'kk') return `${n} ${t(forms[0])}`;
  return `${n} ${t(n === 1 ? forms[0] : forms[2])}`;
}

/** Меню на языке человека: подписи разделов и пунктов. Права, адреса и подсветку решает русский реестр до перевода */
export function translateSections<S extends { label: string; items: Array<{ label: string }> }>(
  sections: S[],
  t: Translate,
): S[] {
  return sections.map((s) => ({ ...s, label: t(s.label), items: s.items.map((i) => ({ ...i, label: t(i.label) })) }));
}
