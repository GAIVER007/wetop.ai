import type { PeriodOperations } from '../../lib/api';
import { csvField as field, csvTenge as tenge } from './csv';
import { METHOD_RU, operationKind, operationStatus } from './labels';

type Operation = PeriodOperations['rows'][number];

/**
 * Общая лента денег за период для бухгалтера (ADR-113 F2; касса — §21): «;», UTF-8 с BOM, строки через CRLF.
 * Дата и время — по часам объекта, возврат и расход — с минусом, перевод — «откуда → куда». Имён гостей нет:
 * файл уходит из системы, бронь находится по номеру.
 */
export function operationsCsv(rows: Operation[]): string {
  const head = ['Дата', 'Время', 'Тип', 'Статус', 'Способ', 'Сумма, ₸', 'Бронь', 'Статья', 'Комментарий'];
  const lines = rows.map((o) => {
    const [day = '', time = ''] = o.localAt.split(' ');
    const [y, m, d] = day.split('-');
    const booking = o.confirmationNumber
      ? o.reservations > 1
        ? `${o.confirmationNumber} и ещё ${o.reservations - 1}`
        : o.confirmationNumber
      : '';
    const method =
      o.kind === 'TRANSFER' && o.methodTo
        ? `${METHOD_RU[o.method] ?? o.method} → ${METHOD_RU[o.methodTo] ?? o.methodTo}`
        : (METHOD_RU[o.method] ?? o.method);
    return [
      `${d}.${m}.${y}`,
      time,
      operationKind(o.kind),
      operationStatus(o.kind, o.status),
      method,
      tenge(o.amountMinor, o.kind === 'REFUND' || o.kind === 'EXPENSE'),
      booking,
      o.category ?? '',
      o.note ?? '',
    ]
      .map(field)
      .join(';');
  });
  return `\uFEFF${[head.join(';'), ...lines].join('\r\n')}`;
}
