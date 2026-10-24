/**
 * Деньги на экране по DESIGN.md §14: «12 500 ₸» без тиынов, если сумма целая; «12 500,50 ₸», если нет.
 * На входе строка в тиынах (ADR-008) — float здесь нет. Отрицательное — с минусом «−» (U+2212).
 * `formatMinor` из lib/api.ts печатает копейки всегда и остаётся для счёта; здесь — для плашек,
 * таблиц и показателей, где тиыны только шумят.
 */
import { parseMoney } from '../../../../packages/domain/src/finance/finance';
export function formatMoney(minor: string | bigint, currency = 'KZT'): string {
  const v = typeof minor === 'bigint' ? minor : BigInt(minor);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const cents = Number(abs % 100n);
  const tail = cents ? `,${String(cents).padStart(2, '0')}` : '';
  return `${neg ? '−' : ''}${whole}${tail} ${currency === 'KZT' ? '₸' : currency}`;
}

/**
 * Тиыны строкой → значение поля ввода без потери копеек: `123450` → `1234.50`, `800000` → `8000`.
 * Иначе поле правки цены показывало бы округлённую сумму, и слепой Enter переписывал бы цену.
 */
export function minorToInput(minor: string): string {
  const negative = minor.startsWith('-');
  const digits = minor.replace('-', '').padStart(3, '0');
  const whole = digits.slice(0, -2);
  const fraction = digits.slice(-2);
  return `${negative ? '-' : ''}${whole}${fraction === '00' ? '' : `.${fraction}`}`;
}

/**
 * Обратное `minorToInput`: «8000», «8 000», «1234,5» → тиыны строкой. Пусто → ''. Не сумма → null.
 * Человек вводит цену в тенге (или выбранной валюте); в базе по-прежнему целые тиыны (ADR-008).
 */
export function inputToMinor(text: string): string | null {
  const clean = text.replace(/\s/g, '');
  if (!clean) return '';
  try {
    const minor = parseMoney(clean);
    return minor < 0n ? null : minor.toString();
  } catch {
    return null;
  }
}

/** Печатные формы: тиыны показываются всегда, без float-арифметики. */
export function formatMinor(minor: string, currency = 'KZT'): string {
  const neg = minor.startsWith('-');
  const digits = minor.replace('-', '').padStart(3, '0');
  const int = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${neg ? '−' : ''}${int},${digits.slice(-2)} ${currency === 'KZT' ? '₸' : currency}`;
}

/** Знак валюты в подписи поля или колонки: тенге значком «₸», остальные кодом (USD, AED). Валюта объекта, не всегда тенге */
export function currencySign(currency = 'KZT'): string {
  return currency === 'KZT' ? '₸' : currency;
}
