import { reservationStatusWords, sourceNames, type ReservationListRow } from '../../lib/hotel-api';
import { csvField, csvTenge } from '../finance/csv';

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
 * Список броней в Excel (H11 плана развития, ADR-141): тот же отбор, что на экране «Брони», в формате выгрузок
 * финансов («;», UTF-8 с BOM, CRLF, суммы вида «12500,50»). Имён и контактов гостей нет: файл уходит из системы
 * (ADR-018, база вне РК), бронь находится по номеру.
 */
export function reservationsCsv(rows: ReservationListRow[]): string {
  const head = [
    'Бронь',
    'Статус',
    'Источник',
    'Канал',
    'Заезд',
    'Выезд',
    'Ночей',
    'Размещений',
    'Места',
    'Сумма, ₸',
    'Оплачено, ₸',
    'Остаток, ₸',
  ];
  const lines = rows.map((x) =>
    [
      x.confirmationNumber,
      reservationStatusWords[x.status] || x.status,
      sourceNames[x.source] || x.source,
      x.channel ?? '',
      dmy(x.arrivalDate),
      dmy(x.departureDate),
      String(nights(x.arrivalDate, x.departureDate)),
      String(x.itemsCount ?? x.unitCodes.length),
      x.unitCodes.join(' '),
      csvTenge(x.totalAmountMinor),
      csvTenge(x.paidMinor),
      csvTenge(x.balanceMinor),
    ]
      .map(csvField)
      .join(';'),
  );
  return `\uFEFF${[head.join(';'), ...lines].join('\r\n')}`;
}
