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

/**
 * SITE-2: цена услуги или блюда снимком из данных WETOP (`{ minor, currency }`), в HTML страницы. Это не живая цена
 * номера: её поставила платформа из данных филиала при сборке документа. Деление на 10^n без float: строка minor units
 * режется по числу знаков валюты, Intl только форматирует итог. Неверная строка или валюта: цены нет
 */
export function formatMoney(money: unknown, locale: Locale): string | null {
  if (money === null || typeof money !== 'object') return null;
  const { minor, currency } = money as { minor?: unknown; currency?: unknown };
  if (typeof minor !== 'string' || !/^(?:0|[1-9][0-9]{0,14})$/.test(minor)) return null;
  if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) return null;
  let format: Intl.NumberFormat;
  try {
    format = new Intl.NumberFormat(INTL_LOCALE[locale] ?? 'ru-RU', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' });
  } catch {
    return null;
  }
  const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
  const padded = minor.padStart(digits + 1, '0');
  const whole = padded.slice(0, padded.length - digits) || '0';
  const fraction = digits ? padded.slice(padded.length - digits) : '';
  const exact = fraction && /[1-9]/.test(fraction) ? `${whole}.${fraction}` : whole;
  try {
    return new Intl.NumberFormat(INTL_LOCALE[locale] ?? 'ru-RU', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: exact.includes('.') ? digits : 0,
      maximumFractionDigits: digits,
    }).format(exact as unknown as number);
  } catch {
    return null;
  }
}

/** Цена для schema.org: десятичная строка без float (`250000` KZT → `2500.00`) */
export function moneyDecimal(money: unknown): { price: string; currency: string } | null {
  if (money === null || typeof money !== 'object') return null;
  const { minor, currency } = money as { minor?: unknown; currency?: unknown };
  if (typeof minor !== 'string' || !/^(?:0|[1-9][0-9]{0,14})$/.test(minor)) return null;
  if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) return null;
  let digits: number;
  try {
    digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return null;
  }
  const padded = minor.padStart(digits + 1, '0');
  const whole = padded.slice(0, padded.length - digits);
  return { price: digits ? `${whole}.${padded.slice(padded.length - digits)}` : whole, currency };
}
