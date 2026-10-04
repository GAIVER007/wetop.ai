import type { PeriodDebts } from '../../lib/api';
import { reservationStatusWords } from '../../lib/hotel-api';
import { csvField, csvTenge } from './csv';

type DebtRow = PeriodDebts['rows'][number];

const dmy = (isoDate: string) => {
  const [y, m, d] = isoDate.split('-');
  return `${d}.${m}.${y}`;
};
const nights = (from: string, to: string) =>
  Math.max(0, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000));

/**
 * «Брони с остатком к сбору» за период для бухгалтера (REP1, план `plans/reports-hub-2026-10-02.md`):
 * тот же формат, что у выгрузки операций — «;», UTF-8 с BOM, CRLF, суммы вида «12500,50».
 * Имён гостей нет намеренно: файл уходит из системы, а бронь находится по номеру.
 */
export function debtsCsv(rows: DebtRow[]): string {
  const head = [
    'Бронь',
    'Статус',
    'Заезд',
    'Выезд',
    'Ночей',
    'Начислено, ₸',
    'Оплачено, ₸',
    'Возвращено, ₸',
    'Остаток, ₸',
    'Просрочено',
  ];
  const lines = rows.map((x) =>
    [
      x.confirmationNumber,
      reservationStatusWords[x.status] || x.status,
      dmy(x.arrivalDate),
      dmy(x.departureDate),
      String(nights(x.arrivalDate, x.departureDate)),
      csvTenge(x.chargedMinor),
      csvTenge(x.paidMinor),
      csvTenge(x.refundedMinor),
      csvTenge(x.balanceMinor),
      x.overdue ? 'да' : '',
    ]
      .map(csvField)
      .join(';'),
  );
  return `\uFEFF${[head.join(';'), ...lines].join('\r\n')}`;
}
