import type { Locale } from '../types';

/**
 * Подпись цены «от» (`B-FROMPRICE`, Q-276): «от 25 000 ₸ / ночь». Функция `formatFromPrice` встраивается в клиентский
 * скрипт цен как есть (`prices-script.ts`), поэтому написана без импортов и замыканий: тест проверяет ту же функцию,
 * что выполняет браузер. Казахская подпись ждёт проверки носителем языка до публичного запуска (MKT12).
 */
export const PRICE_LABEL: Record<Locale, string> = {
  ru: 'от {price} / ночь',
  kk: '{price} бастап / түн',
  en: 'from {price} / night',
};

export const INTL_LOCALE: Record<Locale, string> = { ru: 'ru-RU', kk: 'kk-KZ', en: 'en-US' };

/** Цена в тиынах строкой → подпись; неверное число, валюта или формат дают `null`, и цена не показывается */
export function formatFromPrice(minor: unknown, currency: unknown, locale: string, label: string): string | null {
  if (typeof minor !== 'string' || !/^\d{1,15}$/.test(minor)) return null;
  if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) return null;
  const major = Number(minor) / 100;
  let price: string;
  try {
    price = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: major % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    return null;
  }
  return label.replace('{price}', price);
}
