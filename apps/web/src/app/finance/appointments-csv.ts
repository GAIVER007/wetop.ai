import type { BeautyDay } from '../../lib/api';
import { beautyStatus } from '../../lib/status/beauty';
import { localInput } from '../beauty/time';
import { csvField, csvTenge } from './csv';
import { appointmentSourceLabel } from '../../lib/appointment-source';

const clock = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const ruDate = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/**
 * Записи салона за период (Q-BS-6): тот же формат, что у выгрузок финансов (`;`, UTF-8 с BOM, CRLF, «12500,50»).
 * Имени и телефона клиента нет по правилу выгрузок: файл уходит из системы.
 */
/** Что выгрузке действительно нужно от дня: период финансов отдаёт строки без колонок журнала и сетки */
export type CsvDay = Pick<BeautyDay, 'date' | 'columns' | 'appointments'> & {
  location: Pick<BeautyDay['location'], 'timezone'>;
};

export function appointmentsCsv(days: CsvDay[]): string {
  const head = [
    'Дата', // kk-allow: заголовки выгрузки для бухгалтерии
    'Время', // kk-allow: заголовки выгрузки для бухгалтерии
    'Мастер', // kk-allow: заголовки выгрузки для бухгалтерии
    'Услуга', // kk-allow: заголовки выгрузки для бухгалтерии
    'Статус', // kk-allow: заголовки выгрузки для бухгалтерии
    'Источник', // kk-allow: заголовки выгрузки для бухгалтерии
    'Автор', // kk-allow: заголовки выгрузки для бухгалтерии
    'Валюта', // kk-allow: заголовки выгрузки для бухгалтерии
    'Цена', // kk-allow: заголовки выгрузки для бухгалтерии
    'Оплачено', // kk-allow: заголовки выгрузки для бухгалтерии
    'Возвращено', // kk-allow: заголовки выгрузки для бухгалтерии
  ];
  const seen = new Set<string>();
  const lines = [...days]
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((d) => {
      const names = new Map(d.columns.map((c) => [c.id, c.name]));
      return [...d.appointments]
        .filter((a) => {
          // Calendar responses include prior-day tails; reports attribute each visit to its local start.
          if (localInput(a.startsAt, d.location.timezone).slice(0, 10) !== d.date || seen.has(a.id))
            return false;
          seen.add(a.id);
          return true;
        })
        .sort((a, b) => a.startMinutes - b.startMinutes)
        .map((a) =>
          [
            ruDate(d.date),
            clock(a.startMinutes),
            a.items?.length
              ? [...new Set(a.items.map((item) => item.employeeName))].join(', ')
              : (names.get(a.employeeId) ?? 'Мастер'), // kk-allow: значение выгрузки для бухгалтерии
            a.items?.length ? a.items.map((item) => item.serviceName).join(', ') : a.serviceName,
            beautyStatus[a.status].label,
            appointmentSourceLabel(a.source),
            a.createdByName ?? '',
            a.currency,
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
