/**
 * Деньги на экране по DESIGN.md §14: «12 500 ₸» без тиынов, если сумма целая; «12 500,50 ₸», если нет.
 * На входе строка в тиынах (ADR-008) — float здесь нет. Отрицательное — с минусом «−» (U+2212).
 * `formatMinor` из lib/api.ts печатает копейки всегда и остаётся для счёта; здесь — для плашек,
 * таблиц и показателей, где тиыны только шумят.
 */
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
