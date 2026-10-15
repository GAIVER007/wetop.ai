import { describe, expect, it } from 'vitest';
import type { GuestMainStay } from '../../lib/api';
import {
  cardHref,
  guestNote,
  initials,
  pageWindow,
  stayActions,
  stayPayment,
  stayStatus,
  visitsWord,
  vsYesterday,
} from './guest-stay';

const TODAY = '2026-10-09';
const stay = (over: Partial<GuestMainStay> = {}): GuestMainStay => ({
  kind: 'current',
  confirmationNumber: 'A1087',
  status: 'CHECKED_IN',
  arrivalDate: '2026-10-07',
  departureDate: '2026-10-12',
  nights: 5,
  unitCode: '201',
  accommodationTypeName: 'Комфорт',
  adults: 2,
  children: 0,
  source: 'WEBSITE',
  channel: null,
  currency: 'KZT',
  money: { chargedMinor: '15000000', paidMinor: '15000000', refundedMinor: '0', balanceMinor: '0' },
  ...over,
});
const money = (charged: string, paid: string, refunded = '0') => ({
  chargedMinor: charged,
  paidMinor: paid,
  refundedMinor: refunded,
  balanceMinor: (BigInt(charged) - BigInt(paid) + BigInt(refunded)).toString(),
});

describe('подпись под именем и инициалы', () => {
  it('два визита и больше «Постоянный гость», меньше «Новый гость», без активного проживания так и сказано', () => {
    expect(guestNote({ state: 'INHOUSE', staysCount: 3 })).toBe('Постоянный гость');
    expect(guestNote({ state: 'EXPECTED', staysCount: 2 })).toBe('Постоянный гость');
    expect(guestNote({ state: 'EXPECTED', staysCount: 1 })).toBe('Новый гость');
    expect(guestNote({ state: 'EXPECTED', staysCount: 0 })).toBe('Новый гость');
    // состояние NONE важнее числа визитов: подпись про проживание
    expect(guestNote({ state: 'NONE', staysCount: 5 })).toBe('Без активного проживания');
  });
  it('инициалы: фамилия и имя, лишнее не ломает', () => {
    expect(initials('Петров', 'Сергей')).toBe('ПС');
    expect(initials('  касымова', 'айдана ')).toBe('КА');
    expect(initials('', '')).toBe('?');
  });
});

describe('слово в колонке «Проживание / статус»', () => {
  it('проживает; выезд сегодня другим словом и тоном', () => {
    expect(stayStatus({ state: 'INHOUSE', stay: stay(), last: null }, TODAY)).toEqual({
      word: 'Проживает',
      tone: 'ok',
      note: null,
    });
    expect(
      stayStatus({ state: 'INHOUSE', stay: stay({ departureDate: TODAY }), last: null }, TODAY),
    ).toEqual({ word: 'Выезд сегодня', tone: 'warn', note: null });
  });
  it('ожидается: заезд сегодня, завтра, позже датой, просроченный словом «был»', () => {
    const at = (arrivalDate: string) =>
      stayStatus(
        {
          state: 'EXPECTED',
          stay: stay({ kind: 'next', status: 'CONFIRMED', arrivalDate }),
          last: null,
        },
        TODAY,
      );
    expect(at(TODAY)).toMatchObject({ word: 'Ожидается', tone: 'info', note: 'Заезд сегодня' });
    expect(at('2026-10-10')?.note).toBe('Завтра');
    expect(at('2026-10-15')?.note).toMatch(/15/);
    expect(at('2026-10-05')?.note).toMatch(/^Заезд был .*5/);
  });
  it('недавно выехавшему «Завершено» с датой выезда, у гостя без проживания бейджа нет', () => {
    expect(
      stayStatus(
        {
          state: 'RECENT',
          stay: stay({ kind: 'last', status: 'CHECKED_OUT' }),
          last: { arrivalDate: '2026-10-01', departureDate: '2026-10-05', unitCode: '3', confirmationNumber: 'X' },
        },
        TODAY,
      ),
    ).toMatchObject({ word: 'Завершено', tone: 'neutral', note: expect.stringMatching(/5/) });
    expect(stayStatus({ state: 'NONE', stay: null, last: null }, TODAY)).toBeNull();
  });
});

describe('оплата основного проживания', () => {
  it('нет проживания или нет счёта: оплаты в строке нет', () => {
    expect(stayPayment(null)).toBeNull();
    expect(stayPayment(stay({ money: null }))).toBeNull();
    expect(stayPayment(stay({ money: money('0', '0') }))).toBeNull();
  });
  it('оплачено целиком: слово и сумма оплаты', () => {
    expect(stayPayment(stay())).toEqual({ state: 'paid', minor: '15000000' });
  });
  it('у заселённого и выехавшего остаток это долг, у будущей брони «не оплачено» и «оплачено частично»', () => {
    const partial = money('5000000', '2000000');
    expect(stayPayment(stay({ money: partial }))).toEqual({ state: 'due', minor: '3000000' });
    expect(stayPayment(stay({ status: 'CHECKED_OUT', money: money('5000000', '0') }))).toEqual({
      state: 'due',
      minor: '5000000',
    });
    const future = { kind: 'next' as const, status: 'CONFIRMED' };
    expect(stayPayment(stay({ ...future, money: money('5000000', '0') }))).toEqual({
      state: 'unpaid',
      minor: '5000000',
    });
    expect(stayPayment(stay({ ...future, money: partial }))).toEqual({
      state: 'partial',
      minor: '3000000',
    });
  });
  it('переплата к возврату и сделанный возврат', () => {
    expect(stayPayment(stay({ status: 'CHECKED_OUT', money: money('1000000', '1500000') }))).toEqual({
      state: 'refund',
      minor: '500000',
    });
    expect(stayPayment(stay({ status: 'CHECKED_OUT', money: money('0', '700000', '700000') }))).toEqual({
      state: 'refunded',
      minor: '700000',
    });
  });
});

describe('действия с проживанием: переход в карточку на нужную вкладку', () => {
  it('заселён: выселить, продлить, переселить, услуга; заселить нельзя', () => {
    const a = stayActions(stay());
    expect(a.checkIn).toBeNull();
    expect(a.checkOut).toBe('/reservations/A1087#booking-actions');
    expect(a.extend).toBe('/reservations/A1087#booking-actions');
    expect(a.relocate).toBe('/reservations/A1087#booking-actions');
    expect(a.service).toBe('/reservations/A1087#booking-finance');
    expect(a.open).toBe('/reservations/A1087');
  });
  it('ожидается: заселить вместо выселить', () => {
    const a = stayActions(stay({ kind: 'next', status: 'CONFIRMED' }));
    expect(a.checkIn).toBe('/reservations/A1087#booking-actions');
    expect(a.checkOut).toBeNull();
    expect(a.extend).not.toBeNull();
  });
  it('выехал: только открыть и услуги по счёту; без счёта услуги нет; без проживания ничего', () => {
    const out = stayActions(stay({ kind: 'last', status: 'CHECKED_OUT' }));
    expect(out).toMatchObject({ checkIn: null, checkOut: null, extend: null, relocate: null });
    expect(out.open).not.toBeNull();
    expect(stayActions(stay({ money: null })).service).toBeNull();
    expect(stayActions(null)).toEqual({
      checkIn: null,
      checkOut: null,
      extend: null,
      relocate: null,
      service: null,
      open: null,
    });
  });
  it('номер брони в адресе кодируется', () => {
    expect(cardHref('A B/1', 'finance')).toBe('/reservations/A%20B%2F1#booking-finance');
  });
});

describe('подпись числа визитов', () => {
  it('первый визит, склонение', () => {
    expect(visitsWord(0)).toBe('Первый визит');
    expect(visitsWord(1)).toBe('Первый визит');
    expect(visitsWord(2)).toBe('2 визита');
    expect(visitsWord(5)).toBe('5 визитов');
    expect(visitsWord(11)).toBe('11 визитов');
    expect(visitsWord(21)).toBe('21 визит');
  });
});

describe('сравнение со вчерашним днём', () => {
  it('рост, падение и «как вчера» словами со знаком', () => {
    expect(vsYesterday(5, 4)).toEqual({ direction: 'up', text: '+1 к вчерашнему дню' });
    expect(vsYesterday(3, 5)).toEqual({ direction: 'down', text: '\u22122 к вчерашнему дню' });
    expect(vsYesterday(0, 0)).toEqual({ direction: 'flat', text: 'Как вчера' });
  });
});

describe('номера страниц под таблицей', () => {
  it('до семи страниц показываются все', () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(2, 4)).toEqual([1, 2, 3, 4]);
    expect(pageWindow(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  it('много страниц: начало, окно вокруг текущей и конец, разрывы метятся', () => {
    expect(pageWindow(1, 20)).toEqual([1, 2, 'gap', 19, 20]);
    expect(pageWindow(10, 20)).toEqual([1, 2, 'gap', 9, 10, 11, 'gap', 19, 20]);
    expect(pageWindow(20, 20)).toEqual([1, 2, 'gap', 19, 20]);
    expect(pageWindow(4, 9)).toEqual([1, 2, 3, 4, 5, 'gap', 8, 9]);
  });
});
