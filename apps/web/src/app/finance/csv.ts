/**
 * Общие правила CSV-выгрузок финансов (ADR-113, F2; REP1): разделитель «;», UTF-8 с BOM, CRLF-строки
 * собирает вызывающий. Имён гостей в выгрузках нет: файл уходит из системы, бронь находится по номеру.
 */

/** Тиыны → «12500,50»: без пробелов между разрядами и с запятой — так число понимает Excel в русской раскладке */
export function csvTenge(minor: string, negative = false): string {
  const v = BigInt(minor);
  const abs = v < 0n ? -v : v;
  const sign = negative !== v < 0n ? '-' : '';
  return `${sign}${abs / 100n},${String(abs % 100n).padStart(2, '0')}`;
}

/** Поле с «;», кавычкой или переводом строки берётся в кавычки, кавычки удваиваются */
export const csvField = (s: string) => (/[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
