import type { GuestDirectoryRow } from '../../lib/api';
import { messengerLinks } from '../../lib/format';
import { sourceLabel } from '../../lib/dashboard-format';
import { displayDate } from '../../lib/display-date';
import { formatMoney } from '../../lib/money';
import { pluralRu } from '../../lib/plural';
import type { PaymentState } from '../../lib/status/payment';
import {
  guestNote,
  initials,
  stayActions,
  stayPayment,
  stayStatus,
  visitsWord,
  type StayActions,
} from './guest-stay';

/**
 * Строка таблицы «Гостей и бронирований» для клиентского компонента: всё уже строками, без функций. Сервер считает
 * слова, даты, оплату и доступные действия один раз; клиент только отмечает строки и открывает панель.
 */
export interface GuestRowView {
  id: string;
  name: string;
  initials: string;
  note: string;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  booking: { number: string; href: string } | null;
  status: { word: string; tone: 'neutral' | 'info' | 'ok' | 'warn' | 'danger'; note: string | null } | null;
  dates: { range: string; nights: string } | null;
  unit: { code: string | null; category: string } | null;
  guests: string | null;
  payment: { state: PaymentState; amount: string } | null;
  source: string | null;
  lastVisit: { date: string | null; visits: string };
  /** панель этого гостя: тот же список, выбранный гость в адресе */
  selectHref: string;
  openHref: string;
  newBookingHref: string | null;
  actions: StayActions;
}

/** «7 окт. → 12 окт.», с годом, когда проживание не в текущем году: даты в таблице без года вводили бы в заблуждение */
function stayRange(from: string, to: string, today: string): string {
  const year = today.slice(0, 4);
  const style = from.slice(0, 4) === year && to.slice(0, 4) === year ? 'short' : 'numeric';
  return `${displayDate(from, style)} → ${displayDate(to, style)}`;
}

export function buildRowView(
  row: GuestDirectoryRow,
  ctx: { today: string; selectHref: (id: string) => string; readOnly: boolean },
): GuestRowView {
  const stay = row.stay;
  const payment = stayPayment(stay);
  const lastWithYear = row.last !== null && row.last.departureDate.slice(0, 4) !== ctx.today.slice(0, 4);
  return {
    id: row.id,
    name: `${row.lastName} ${row.firstName} ${row.middleName ?? ''}`.trim(),
    initials: initials(row.lastName, row.firstName),
    note: guestNote(row),
    phone: row.phone,
    email: row.email,
    whatsapp: messengerLinks(row.phone)?.whatsapp ?? null,
    booking: stay?.confirmationNumber
      ? {
          number: stay.confirmationNumber,
          href: `/reservations/${encodeURIComponent(stay.confirmationNumber)}`,
        }
      : null,
    status: stayStatus(row, ctx.today),
    dates: stay
      ? {
          range: stayRange(stay.arrivalDate, stay.departureDate, ctx.today),
          nights: pluralRu(stay.nights, ['ночь', 'ночи', 'ночей']),
        }
      : null,
    unit: stay ? { code: stay.unitCode, category: stay.accommodationTypeName } : null,
    guests: stay ? String(stay.adults + stay.children) : null,
    payment: payment ? { state: payment.state, amount: formatMoney(payment.minor, stay!.currency) } : null,
    source: stay ? sourceLabel(stay.source, stay.channel) : null,
    lastVisit: {
      date: row.last ? displayDate(row.last.departureDate, lastWithYear ? 'numeric' : 'short') : null,
      visits: visitsWord(row.staysCount),
    },
    selectHref: ctx.selectHref(row.id),
    openHref: `/guests/${encodeURIComponent(row.id)}`,
    newBookingHref: ctx.readOnly ? null : `/reservations/new?guest=${encodeURIComponent(row.id)}`,
    actions: ctx.readOnly
      ? { checkIn: null, checkOut: null, extend: null, relocate: null, service: null, open: stayActions(stay).open }
      : stayActions(stay),
  };
}
