import type { PeriodOperations } from '../../lib/api';
import { METHOD_RU, operationKind, operationStatus } from './labels';

type Operation = PeriodOperations['rows'][number];

/** Тиыны → «12500,50»: без пробелов между разрядами и с запятой — так число понимает Excel в русской раскладке */
function tenge(minor: string, negative: boolean): string {
  const v = BigInt(minor);
  const abs = v < 0n ? -v : v;
  const sign = negative !== v < 0n ? '-' : '';
  return `${sign}${abs / 100n},${String(abs % 100n).padStart(2, '0')}`;
}

const field = (s: string) => (/[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/**
 * Оплаты и возвраты за период для бухгалтера (ADR-113, F2): «;», UTF-8 с BOM, строки через CRLF. Дата и время —
 * по часам объекта, возврат — с минусом. Имён гостей нет: файл уходит из системы, а бронь находится по номеру.
 */
export function operationsCsv(rows: Operation[]): string {
  const head = ['Дата', 'Время', 'Тип', 'Статус', 'Способ', 'Сумма, ₸', 'Бронь'];
  const lines = rows.map((o) => {
    const [day = '', time = ''] = o.localAt.split(' ');
    const [y, m, d] = day.split('-');
    const booking = o.confirmationNumber
      ? o.reservations > 1
        ? `${o.confirmationNumber} и ещё ${o.reservations - 1}`
        : o.confirmationNumber
      : '';
    return [
      `${d}.${m}.${y}`,
      time,
      operationKind(o.kind),
      operationStatus(o.kind, o.status),
      METHOD_RU[o.method] ?? o.method,
      tenge(o.amountMinor, o.kind === 'REFUND'),
      booking,
    ]
      .map(field)
      .join(';');
  });
  return `\uFEFF${[head.join(';'), ...lines].join('\r\n')}`;
}
