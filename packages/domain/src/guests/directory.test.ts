import { describe, expect, it } from 'vitest';
import {
  GUEST_RECENT_DAYS,
  countGuestNights,
  pickMainStay,
  shiftDate,
  summarizeGuestStays,
} from './directory';

const TODAY = '2026-09-27';
const stay = (
  status: string,
  arrivalDate: string,
  departureDate: string,
  unitCode: string | null = 'R01',
  accommodationTypeName = 'Двухместный номер',
) => ({ status, arrivalDate, departureDate, unitCode, accommodationTypeName });

describe('summarizeGuestStays — состояние гостя из его проживаний (ТЗ «Гости v2» §12–§16)', () => {
  it('живёт: CHECKED_IN даёт INHOUSE с ячейкой и датой выезда; визит считается', () => {
    const s = summarizeGuestStays(
      [stay('CHECKED_IN', '2026-09-25', '2026-09-30'), stay('CHECKED_OUT', '2026-08-12', '2026-08-15', 'M03')],
      TODAY,
    );
    expect(s.state).toBe('INHOUSE');
    expect(s.current).toEqual({
      unitCode: 'R01',
      accommodationTypeName: 'Двухместный номер',
      departureDate: '2026-09-30',
      confirmationNumber: null,
    });
    expect(s.staysCount).toBe(2);
    expect(s.last).toEqual({
      arrivalDate: '2026-08-12',
      departureDate: '2026-08-15',
      unitCode: 'M03',
      confirmationNumber: null,
    });
  });

  it('предпросмотр (G3): номер брони доезжает до «сейчас», ночи считаются по визитам', () => {
    const s = summarizeGuestStays(
      [
        { ...stay('CHECKED_IN', '2026-09-25', '2026-09-30'), confirmationNumber: 'B-77' },
        stay('CHECKED_OUT', '2026-08-12', '2026-08-15', 'M03'),
        stay('CONFIRMED', '2026-10-04', '2026-10-06'),
        stay('CANCELLED', '2026-07-01', '2026-07-05'),
      ],
      TODAY,
    );
    expect(s.current?.confirmationNumber).toBe('B-77');
    // ночи: 5 (живёт) + 3 (выехал); будущая и отменённая — не визит и не ночи
    expect(
      countGuestNights([
        stay('CHECKED_IN', '2026-09-25', '2026-09-30'),
        stay('CHECKED_OUT', '2026-08-12', '2026-08-15'),
        stay('CONFIRMED', '2026-10-04', '2026-10-06'),
        stay('CANCELLED', '2026-07-01', '2026-07-05'),
      ]),
    ).toBe(8);
  });

  it('ожидается: ближайшая будущая бронь, просроченный заезд остаётся «ожидается»', () => {
    const s = summarizeGuestStays(
      [stay('CONFIRMED', '2026-10-04', '2026-10-06'), stay('CONFIRMED', '2026-11-01', '2026-11-03')],
      TODAY,
    );
    expect(s.state).toBe('EXPECTED');
    expect(s.next?.arrivalDate).toBe('2026-10-04');
    expect(s.staysCount).toBe(0);
    // заезд был позавчера, выезд не наступил — гость всё ещё ожидается (как в «Требуют внимания»)
    const overdue = summarizeGuestStays([stay('CONFIRMED', '2026-09-25', '2026-09-30')], TODAY);
    expect(overdue.state).toBe('EXPECTED');
    expect(overdue.next?.arrivalDate).toBe('2026-09-25');
    // подтверждённая бронь, у которой прошёл и выезд, — не «ожидается» и не визит
    const stale = summarizeGuestStays([stay('CONFIRMED', '2026-09-01', '2026-09-03')], TODAY);
    expect(stale.state).toBe('NONE');
    expect(stale.next).toBeNull();
  });

  it(`выехал недавно: RECENT в пределах ${GUEST_RECENT_DAYS} дней, дальше — NONE`, () => {
    const edge = shiftDate(TODAY, -GUEST_RECENT_DAYS);
    expect(summarizeGuestStays([stay('CHECKED_OUT', '2026-08-20', edge)], TODAY).state).toBe('RECENT');
    expect(
      summarizeGuestStays([stay('CHECKED_OUT', '2026-08-01', shiftDate(edge, -1))], TODAY).state,
    ).toBe('NONE');
  });

  it('живёт > ожидается > выехал: состояния взаимоисключающие, бейдж равен фильтру', () => {
    const all = [
      stay('CHECKED_IN', '2026-09-26', '2026-09-29'),
      stay('CONFIRMED', '2026-10-04', '2026-10-06'),
      stay('CHECKED_OUT', '2026-09-20', '2026-09-22'),
    ];
    expect(summarizeGuestStays(all, TODAY).state).toBe('INHOUSE');
    expect(summarizeGuestStays(all.slice(1), TODAY).state).toBe('EXPECTED');
    expect(summarizeGuestStays(all.slice(2), TODAY).state).toBe('RECENT');
  });

  it('только отменённая бронь — не статус гостя: NONE и дата отменённой (ТЗ §16)', () => {
    const s = summarizeGuestStays([stay('CANCELLED', '2026-09-24', '2026-09-27')], TODAY);
    expect(s.state).toBe('NONE');
    expect(s.staysCount).toBe(0);
    expect(s.lastCancelledAt).toBe('2026-09-24');
    // был настоящий визит — отменённая бронь строку не подписывает
    const visited = summarizeGuestStays(
      [stay('CANCELLED', '2026-09-24', '2026-09-27'), stay('CHECKED_OUT', '2026-05-01', '2026-05-03')],
      TODAY,
    );
    expect(visited.lastCancelledAt).toBeNull();
    // отмена при живой будущей брони тоже не подписывает
    const expecting = summarizeGuestStays(
      [stay('CANCELLED', '2026-09-24', '2026-09-27'), stay('CONFIRMED', '2026-10-04', '2026-10-06')],
      TODAY,
    );
    expect(expecting.lastCancelledAt).toBeNull();
  });

  it('пусто: без проживаний — NONE и прочерки', () => {
    expect(summarizeGuestStays([], TODAY)).toEqual({
      staysCount: 0,
      state: 'NONE',
      current: null,
      next: null,
      last: null,
      lastCancelledAt: null,
    });
  });
});

describe('pickMainStay: основное проживание строки «Гости и бронирования» (09.10.2026)', () => {
  it('заселён важнее ожидаемого, ожидаемый важнее выехавшего; приоритет тот же, что у summarizeGuestStays', () => {
    const stays = [
      { ...stay('CHECKED_OUT', '2026-08-12', '2026-08-15', 'M03'), confirmationNumber: 'OLD' },
      { ...stay('CONFIRMED', '2026-10-04', '2026-10-06'), confirmationNumber: 'SOON' },
      { ...stay('CHECKED_IN', '2026-09-25', '2026-09-30'), confirmationNumber: 'NOW' },
    ];
    expect(pickMainStay(stays, TODAY)).toMatchObject({ kind: 'current', confirmationNumber: 'NOW', nights: 5 });
    expect(pickMainStay(stays.slice(0, 2), TODAY)).toMatchObject({ kind: 'next', confirmationNumber: 'SOON' });
    expect(pickMainStay(stays.slice(0, 1), TODAY)).toMatchObject({ kind: 'last', confirmationNumber: 'OLD' });
    // сходится с колонкой «Сейчас / ближайший»: то же состояние и тот же номер брони
    expect(summarizeGuestStays(stays, TODAY).current?.confirmationNumber).toBe('NOW');
  });

  it('из нескольких ожидаемых берётся ближайший заезд, из выехавших последний выезд, из заселённых поздний заезд', () => {
    expect(
      pickMainStay(
        [
          { ...stay('CONFIRMED', '2026-11-10', '2026-11-12'), confirmationNumber: 'LATE' },
          { ...stay('TENTATIVE', '2026-10-02', '2026-10-03'), confirmationNumber: 'EARLY' },
        ],
        TODAY,
      )?.confirmationNumber,
    ).toBe('EARLY');
    expect(
      pickMainStay(
        [
          { ...stay('CHECKED_OUT', '2026-06-01', '2026-06-03'), confirmationNumber: 'A' },
          { ...stay('CHECKED_OUT', '2026-07-01', '2026-07-03'), confirmationNumber: 'B' },
        ],
        TODAY,
      )?.confirmationNumber,
    ).toBe('B');
    expect(
      pickMainStay(
        [
          { ...stay('CHECKED_IN', '2026-09-20', '2026-09-28'), confirmationNumber: 'FIRST' },
          { ...stay('CHECKED_IN', '2026-09-26', '2026-09-29'), confirmationNumber: 'SECOND' },
        ],
        TODAY,
      )?.confirmationNumber,
    ).toBe('SECOND');
  });

  it('отменённые, незаезды и целиком прошедшие неподтверждённые брони основными не бывают', () => {
    expect(
      pickMainStay(
        [
          stay('CANCELLED', '2026-10-04', '2026-10-06'),
          stay('NO_SHOW', '2026-09-01', '2026-09-03'),
          stay('CONFIRMED', '2026-08-01', '2026-08-03'),
        ],
        TODAY,
      ),
    ).toBeNull();
    expect(pickMainStay([], TODAY)).toBeNull();
  });

  it('гости, источник, валюта и счёт доезжают как есть; без счёта money равен null', () => {
    const money = { chargedMinor: '15000000', paidMinor: '15000000', refundedMinor: '0', balanceMinor: '0' };
    expect(
      pickMainStay(
        [{ ...stay('CHECKED_IN', '2026-09-25', '2026-09-30'), adults: 2, children: 1, source: 'OTA', channel: 'Booking.com', currency: 'KZT', money }],
        TODAY,
      ),
    ).toMatchObject({ adults: 2, children: 1, source: 'OTA', channel: 'Booking.com', currency: 'KZT', money });
    expect(pickMainStay([stay('CHECKED_IN', '2026-09-25', '2026-09-30')], TODAY)).toMatchObject({
      adults: 1,
      children: 0,
      source: 'DESK',
      channel: null,
      money: null,
    });
  });
});
