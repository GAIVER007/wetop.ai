import type { Translate } from '../../../i18n';

/** Флаг из двухбуквенного кода страны: региональные символы Unicode («Страны», 29.10.2026) */
export function flag(code: string): string {
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** Название страны на языке страницы; кода нет: «Страна не указана» */
export function countryName(code: string | null, locale: string, t: Translate): string {
  if (!code) return t('Страна не указана');
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}
