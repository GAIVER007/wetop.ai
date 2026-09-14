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
