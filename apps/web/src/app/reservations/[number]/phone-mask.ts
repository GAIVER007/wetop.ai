/**
 * Номер гостя для быстрого просмотра брони (ADR-106, R3; ТЗ «Брони v2» §11, §19): код страны и две
 * последние цифры, остальное звёздочками. Позвонить и написать можно кнопками — цифры им не нужны на экране.
 */
export function maskPhone(phone: string | null | undefined): string | null {
  const raw = (phone ?? '').trim();
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length < 2) return '***';
  const tail = digits.slice(-2);
  if (digits.length < 10) return `*** ${tail}`;
  // Записан группами («+998 90 …») — код страны первой группой; слитно — всё, что до десяти цифр номера
  const firstGroup = /^\+?(\d{1,4})[\s(-]/.exec(raw)?.[1];
  const country = firstGroup ?? digits.slice(0, digits.length - 10);
  const prefix = country ? `${raw.startsWith('+') ? '+' : ''}${country} ` : '';
  return `${prefix}*** *** ** ${tail}`;
}
