import type { PeriodDebts } from '../../lib/api';
import { hospitalityStatus } from '../../lib/status/hospitality';
import { statusLabel } from '../../lib/status/types';
import { csvField, csvTenge } from './csv';
import { currencySign } from '../../lib/money';

type DebtRow = PeriodDebts['rows'][number];

const dmy = (isoDate: string) => {
  const [y, m, d] = isoDate.split('-');
  return `${d}.${m}.${y}`;
};
const nights = (from: string, to: string) =>
  Math.max(
    0,
    Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000),
  );

/**
 * «Брони с остатком к сбору» за период для бухгалтера (REP1, план `plans/reports-hub-2026-10-02.md`):
 * тот же формат, что у выгрузки операций — «;», UTF-8 с BOM, CRLF, суммы вида «12500,50».
 * Имён гостей нет намеренно: файл уходит из системы, а бронь находится по номеру.
 */
export function debtsCsv(rows: DebtRow[], currency = 'KZT'): string {
  const sign = currencySign(currency);
  const head = [
    'Бронь', // kk-allow: заголовки выгрузки для бухгалтерии
    'Статус', // kk-allow: заголовки выгрузки для бухгалтерии
    'Заезд', // kk-allow: заголовки выгрузки для бухгалтерии
    'Выезд', // kk-allow: заголовки выгрузки для бухгалтерии
    'Ночей', // kk-allow: заголовки выгрузки для бухгалтерии
    `Начислено, ${sign}`, // kk-allow: заголовки выгрузки для бухгалтерии
    `Оплачено, ${sign}`, // kk-allow: заголовки выгрузки для бухгалтерии
    `Возвращено, ${sign}`, // kk-allow: заголовки выгрузки для бухгалтерии
    `Остаток, ${sign}`, // kk-allow: заголовки выгрузки для бухгалтерии
    'Просрочено', // kk-allow: заголовки выгрузки для бухгалтерии
  ];
  const lines = rows.map((x) =>
    [
      x.confirmationNumber,
      statusLabel(hospitalityStatus, x.status),
      dmy(x.arrivalDate),
      dmy(x.departureDate),
      String(nights(x.arrivalDate, x.departureDate)),
      csvTenge(x.chargedMinor),
      csvTenge(x.paidMinor),
      csvTenge(x.refundedMinor),
      csvTenge(x.balanceMinor),
      x.overdue ? 'да' : '', // kk-allow: значение выгрузки для бухгалтерии
    ]
      .map(csvField)
      .join(';'),
  );
  return `\uFEFF${[head.join(';'), ...lines].join('\r\n')}`;
}
