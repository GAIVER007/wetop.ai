/**
 * Чистые помощники показа: деньги и ссылки в мессенджеры. Отдельно от `api.ts`, потому что клиент API
 * читает cookie сессии через `next/headers` и в клиентские компоненты попадать не должен, а эти две
 * функции нужны и на стороне браузера.
 */
/** Тиыны → строка в тенге с разделителями, без float-арифметики. */
/**
 * T5: ссылки в мессенджеры по телефону гостя. Телефон приводим к цифрам — оба сервиса ждут
 * международный формат без плюса и разделителей. Пустой или слишком короткий номер ссылок не даёт.
 */
export function messengerLinks(phone: string | null | undefined): {
  whatsapp: string;
  telegram: string;
} | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  return { whatsapp: `https://wa.me/${digits}`, telegram: `https://t.me/+${digits}` };
}

export function formatMinor(minor: string, currency = 'KZT'): string {
  const neg = minor.startsWith('-');
  const digits = minor.replace('-', '').padStart(3, '0');
  const int = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${neg ? '−' : ''}${int},${digits.slice(-2)} ${currency === 'KZT' ? '₸' : currency}`;
}
