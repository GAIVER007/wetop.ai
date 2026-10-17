import type { BeautyDay } from '../../lib/api';
import { beautyStatus } from '../../lib/status/beauty';
import { csvField, csvTenge } from './csv';

const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const ruDate = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/**
 * Записи салона за период (Q-BS-6): тот же формат, что у выгрузок финансов (`;`, UTF-8 с BOM, CRLF, «12500,50»).
 * Имени и телефона клиента нет по правилу выгрузок: файл уходит из системы.
 */
export function appointmentsCsv(days: BeautyDay[]): string {
  const head = ['Дата', 'Время', 'Мастер', 'Услуга', 'Статус', 'Цена, ₸', 'Оплачено, ₸', 'Возвращено, ₸'];
  const lines = [...days]
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((d) => {
      const names = new Map(d.columns.map((c) => [c.id, c.name]));
      return [...d.appointments]
        .sort((a, b) => a.startMinutes - b.startMinutes)
        .map((a) =>
          [
            ruDate(d.date),
            clock(a.startMinutes),
            names.get(a.employeeId) ?? 'Мастер',
            a.serviceName,
            beautyStatus[a.status].label,
            csvTenge(a.priceMinor),
            csvTenge(a.paidMinor),
            csvTenge(a.refundedMinor),
          ]
            .map(csvField)
            .join(';'),
        );
    });
  return `\uFEFF${[head.join(';'), ...lines].join('\r\n')}`;
}
