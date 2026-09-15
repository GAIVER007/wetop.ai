/**
 * Деньги на экране по DESIGN.md §14: «12 500 ₸» — без копеек, если их нет; тиыны только когда они
 * есть («1 234,50 ₸»). Вход — строка тиынов из API (integer minor units, ADR-008), без float.
 * Существующий `formatMinor` в lib/api.ts печатает «12 500,00 ₸» всегда — переводится на эту функцию
 * на шаге 7.4 плана дизайн-системы вместе с экранами.
 */
export function formatMoney(minor: string | bigint, currency = 'KZT'): string {
  const raw = typeof minor === 'bigint' ? minor.toString() : minor;
  const neg = raw.startsWith('-');
  const digits = raw.replace('-', '').padStart(3, '0');
  const int = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const frac = digits.slice(-2);
  const sign = currency === 'KZT' ? '₸' : currency;
  return `${neg ? '−' : ''}${int}${frac === '00' ? '' : `,${frac}`} ${sign}`;
}

/**
 * Цена из тиынов в то, что администратор правит в поле (срез 7.2, правка цены в ячейке):
 * копейки показываем, только если они есть. Без этого 1 234,50 ₸ открывалось как «1234»,
 * и слепой Enter переписывал цену на 1 234,00 ₸ — вместе с отправкой в Channex.
 */
export function minorToInput(minor: string): string {
  const negative = minor.startsWith('-');
  const digits = minor.replace('-', '').padStart(3, '0');
  const whole = digits.slice(0, -2);
  const fraction = digits.slice(-2);
  return `${negative ? '-' : ''}${whole}${fraction === '00' ? '' : `.${fraction}`}`;
}
