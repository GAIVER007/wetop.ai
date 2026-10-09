import { shiftDate } from '@pms/domain';
import type { GuestDirectoryRow, GuestMainStay } from '../../lib/api';
import type { Delta } from '../../lib/dashboard-format';
import { displayDate } from '../../lib/display-date';
import { financeState } from '../reservations/finance-state';
import type { PaymentState } from '../../lib/status/payment';

/**
 * Представление строки «Гостей и бронирований» (план guests-bookings-2026-10-09): слова, оплата и доступные
 * действия считаются здесь, чистыми функциями, а не в разметке. Ничего нового в правилах: оплата читается из счёта
 * проживания тем же `financeState`, что колонка «Финансы» в «Бронях»; статус брони наружу не идёт (ТЗ «Гости v2» §15).
 */

/**
 * Порог «Постоянного гостя»: два визита и больше. В модели такого статуса нет, правило взято из макета владельца
 * 09.10.2026 как умолчание; пороги за владельцем (Q-GB-2).
 */
export const REGULAR_GUEST_VISITS = 2;

export const isRegularGuest = (visits: number) => visits >= REGULAR_GUEST_VISITS;

/** Подпись под именем: «Постоянный гость», «Новый гость»; у гостя без активного проживания так и сказано */
export function guestNote(row: Pick<GuestDirectoryRow, 'state' | 'staysCount'>): string {
  if (row.state === 'NONE') return 'Без активного проживания';
  return isRegularGuest(row.staysCount) ? 'Постоянный гость' : 'Новый гость';
}

/** Инициалы для кружка: первая буква фамилии и имени */
export function initials(lastName: string, firstName: string): string {
  const first = (text: string) => text.trim().charAt(0).toLocaleUpperCase('ru');
  return `${first(lastName)}${first(firstName)}` || '?';
}

type BadgeTone = 'neutral' | 'info' | 'ok' | 'warn' | 'danger';

/**
 * Слово и тон в колонке «Проживание / статус» и дата или пояснение под ним. Состояние человека, а не брони:
 * «Проживает», «Выезд сегодня», «Ожидается» (и когда заезд), «Завершено». У гостя без активного проживания бейджа нет.
 */
export function stayStatus(
  row: Pick<GuestDirectoryRow, 'state' | 'stay' | 'last'>,
  today: string,
): { word: string; tone: BadgeTone; note: string | null } | null {
  if (row.state === 'INHOUSE') {
    return row.stay?.departureDate === today
      ? { word: 'Выезд сегодня', tone: 'warn', note: null }
      : { word: 'Проживает', tone: 'ok', note: null };
  }
  if (row.state === 'EXPECTED') {
    const arrival = row.stay?.arrivalDate;
    const note = !arrival
      ? null
      : arrival === today
        ? 'Заезд сегодня'
        : arrival === shiftDate(today, 1)
          ? 'Завтра'
          : arrival < today
            ? `Заезд был ${displayDate(arrival)}`
            : displayDate(arrival);
    return { word: 'Ожидается', tone: 'info', note };
  }
  if (row.state === 'RECENT')
    return {
      word: 'Завершено',
      tone: 'neutral',
      note: row.last ? displayDate(row.last.departureDate) : null,
    };
  return null;
}

/**
 * Оплата основного проживания: состояние из реестра `payment` и сумма. У заселённого или выехавшего неоплаченный
 * остаток это долг, у будущей брони «не оплачено» или «оплачено частично»; счёта нет, значит оплаты в строке нет.
 */
export function stayPayment(
  stay: GuestMainStay | null,
): { state: PaymentState; minor: string } | null {
  if (!stay?.money) return null;
  const money = stay.money;
  const live = stay.status === 'CHECKED_IN' || stay.status === 'CHECKED_OUT';
  const state = financeState({
    hasFolios: true,
    paidMinor: money.paidMinor,
    balanceMinor: money.balanceMinor,
    chargedMinor: money.chargedMinor,
    refundedMinor: money.refundedMinor,
  });
  switch (state.kind) {
    case 'paid':
      return { state: 'paid', minor: money.paidMinor };
    case 'unpaid':
      return { state: live ? 'due' : 'unpaid', minor: money.balanceMinor };
    case 'due':
      return { state: live ? 'due' : 'partial', minor: money.balanceMinor };
    case 'refund-due':
      return { state: 'refund', minor: state.minor.toString() };
    case 'refunded':
      return { state: 'refunded', minor: money.refundedMinor };
    default:
      return null;
  }
}

/** Адрес карточки брони на нужной вкладке (`booking-actions`, `booking-finance`): тот же приём, что у ссылок «Открыть бронь» */
export const cardHref = (number: string, tab?: 'actions' | 'finance') =>
  `/reservations/${encodeURIComponent(number)}${tab ? `#booking-${tab}` : ''}`;

export interface StayActions {
  checkIn: string | null;
  checkOut: string | null;
  extend: string | null;
  relocate: string | null;
  service: string | null;
  open: string | null;
}

/**
 * Что можно сделать с проживанием: каждое действие это переход в карточку брони на вкладку, где оно уже умеет всё
 * с подтверждением сумм (Q-GB-4: массовых «Заселить» и «Выселить» нет). `null` в поле, когда действие не подходит
 * статусу: те же условия, что у кнопок карточки.
 */
export function stayActions(stay: GuestMainStay | null): StayActions {
  const none = { checkIn: null, checkOut: null, extend: null, relocate: null, service: null, open: null };
  const number = stay?.confirmationNumber;
  if (!stay || !number) return none;
  const expected = stay.status === 'CONFIRMED' || stay.status === 'TENTATIVE';
  const inHouse = stay.status === 'CHECKED_IN';
  return {
    open: cardHref(number),
    checkIn: expected ? cardHref(number, 'actions') : null,
    checkOut: inHouse ? cardHref(number, 'actions') : null,
    extend: expected || inHouse ? cardHref(number, 'actions') : null,
    relocate: expected || inHouse ? cardHref(number, 'actions') : null,
    service: stay.money ? cardHref(number, 'finance') : null,
  };
}

/** «5 визитов», «Первый визит»: подпись под датой последнего визита */
export function visitsWord(count: number): string {
  if (count <= 1) return 'Первый визит';
  const d = count % 10;
  const h = count % 100;
  const word = h >= 11 && h <= 14 ? 'визитов' : d === 1 ? 'визит' : d >= 2 && d <= 4 ? 'визита' : 'визитов';
  return `${count} ${word}`;
}

/**
 * Сравнение числа заездов или выездов со вчерашним днём словами со знаком: «+1 к вчерашнему дню». Считается по датам
 * брони с обеих сторон; у «Проживают» сравнения нет (истории статусов в модели нет, Q-GB-3).
 */
export function vsYesterday(today: number, yesterday: number): Delta {
  const diff = today - yesterday;
  if (diff === 0) return { direction: 'flat', text: 'Как вчера' };
  return {
    direction: diff > 0 ? 'up' : 'down',
    text: `${diff > 0 ? '+' : '\u2212'}${Math.abs(diff)} к вчерашнему дню`,
  };
}

/** Номера страниц для полосы под таблицей: все, пока их немного, иначе начало, окно вокруг текущей и конец */
export function pageWindow(page: number, pages: number): Array<number | 'gap'> {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const shown = new Set([1, 2, pages - 1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const sorted = [...shown].sort((a, b) => a - b);
  return sorted.flatMap((n, i) => (i > 0 && n - sorted[i - 1]! > 1 ? ['gap' as const, n] : [n]));
}
