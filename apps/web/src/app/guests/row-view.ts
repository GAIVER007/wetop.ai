import type { GuestDirectoryRow } from '../../lib/api';
import { messengerLinks } from '../../lib/format';
import { sourceLabel } from '../../lib/dashboard-format';
import { displayDate } from '../../lib/display-date';
import { formatMoney } from '../../lib/money';
import { intlLocale } from '../../i18n';
import { nightsLabel, RU, type Lang } from '../chessboard/lang';
import type { PaymentState } from '../../lib/status/payment';
import {
  guestNote,
  initials,
  stayActions,
  stayPayment,
  stayStatus,
  visitsWord,
  guestDisplayName,
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
  /** даты проживания: машиночитаемые (`<time dateTime>`) и подписанные */
  dates: { from: { iso: string; text: string }; to: { iso: string; text: string }; nights: string } | null;
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

/** «7 окт.» и «12 окт.», с годом, когда проживание не в текущем году: даты в таблице без года вводили бы в заблуждение */
function stayRange(from: string, to: string, today: string, lang: Lang) {
  const year = today.slice(0, 4);
  const style = from.slice(0, 4) === year && to.slice(0, 4) === year ? 'short' : 'numeric';
  const locale = intlLocale(lang.locale);
  return {
    from: { iso: from, text: displayDate(from, style, locale) },
    to: { iso: to, text: displayDate(to, style, locale) },
  };
}

export function buildRowView(
  row: GuestDirectoryRow,
  ctx: { today: string; selectHref: (id: string) => string; readOnly: boolean; lang?: Lang },
): GuestRowView {
  const lang = ctx.lang ?? RU;
  const stay = row.stay;
  const payment = stayPayment(stay);
  const lastWithYear = row.last !== null && row.last.departureDate.slice(0, 4) !== ctx.today.slice(0, 4);
  return {
    id: row.id,
    name: guestDisplayName(row),
    initials: initials(row.lastName, row.firstName),
    note: guestNote(row, lang),
    phone: row.phone,
    email: row.email,
    whatsapp: messengerLinks(row.phone)?.whatsapp ?? null,
    booking: stay?.confirmationNumber
      ? {
          number: stay.confirmationNumber,
          href: `/reservations/${encodeURIComponent(stay.confirmationNumber)}`,
        }
      : null,
    status: stayStatus(row, ctx.today, lang),
    dates: stay
      ? {
          ...stayRange(stay.arrivalDate, stay.departureDate, ctx.today, lang),
          nights: nightsLabel(lang, stay.nights),
        }
      : null,
    unit: stay ? { code: stay.unitCode, category: stay.accommodationTypeName } : null,
    guests: stay ? String(stay.adults + stay.children) : null,
    payment: payment ? { state: payment.state, amount: formatMoney(payment.minor, stay!.currency) } : null,
    source: stay ? lang.t(sourceLabel(stay.source, stay.channel)) : null,
    lastVisit: {
      date: row.last ? displayDate(row.last.departureDate, lastWithYear ? 'numeric' : 'short', intlLocale(lang.locale)) : null,
      visits: visitsWord(row.staysCount, lang),
    },
    selectHref: ctx.selectHref(row.id),
    openHref: `/guests/${encodeURIComponent(row.id)}`,
    newBookingHref: ctx.readOnly ? null : `/reservations/new?guest=${encodeURIComponent(row.id)}`,
    actions: ctx.readOnly
      ? { checkIn: null, checkOut: null, extend: null, relocate: null, service: null, open: stayActions(stay).open }
      : stayActions(stay),
  };
}
