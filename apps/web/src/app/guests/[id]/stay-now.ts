import { displayDate } from '../../../lib/display-date';

type Stay = {
  confirmationNumber: string;
  accommodationTypeName: string;
  arrivalDate: string;
  departureDate: string;
  status: string;
  unitCode: string | null;
};

/**
 * Где гость сейчас (D1): живёт, ожидается или когда выехал — одной фразой из истории проживаний.
 * Правил брони здесь нет: только чтение статусов, которые уже стоят у проживаний.
 */
export function stayNow(stays: Stay[], today: string): string {
  const living = stays.find((s) => s.status === 'CHECKED_IN');
  if (living)
    return `живёт${living.unitCode ? `, ${living.unitCode}` : ''}, выезд ${displayDate(living.departureDate, 'numeric')}`;
  const expected = stays
    .filter(
      (s) => (s.status === 'CONFIRMED' || s.status === 'TENTATIVE') && s.departureDate > today,
    )
    .sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate))[0];
  if (expected)
    return `ожидается ${expected.arrivalDate <= today ? 'сегодня' : displayDate(expected.arrivalDate, 'numeric')}${expected.unitCode ? `, ${expected.unitCode}` : ''}`;
  const last = stays
    .filter((s) => s.status === 'CHECKED_OUT')
    .sort((a, b) => b.departureDate.localeCompare(a.departureDate))[0];
  if (last) return `выехал ${displayDate(last.departureDate, 'numeric')}`;
  return '—';
}
