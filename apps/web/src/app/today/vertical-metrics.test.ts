import { describe, expect, it } from 'vitest';
import type { BeautyAppointmentRow, BeautyDay } from '../../lib/api';
import type { DiningArea, DiningTable, RestaurantReservation } from '../../lib/food-types';
import { beautyToday, foodToday, localMinute } from './vertical-metrics';

const column = (id: string, name: string) => ({
  id,
  name,
  intervals: [],
  timeOff: false,
  timeOffReason: null,
  serviceIds: [],
});
const appointment = (
  id: string,
  employeeId: string,
  status: BeautyAppointmentRow['status'],
  startMinutes: number,
  endMinutes: number,
): BeautyAppointmentRow => ({
  id,
  employeeId,
  serviceId: 's',
  serviceName: 'Стрижка',
  customer: { id: `c-${id}`, name: `Клиент ${id}`, phone: null },
  startsAt: '2026-10-07T00:00:00.000Z',
  endsAt: '2026-10-07T01:00:00.000Z',
  startMinutes,
  endMinutes,
  status,
  next: [],
  priceMinor: '0',
  currency: 'KZT',
  notes: null,
});
const day = (appointments: BeautyAppointmentRow[]): BeautyDay => ({
  location: { id: 'l', name: 'Салон', timezone: 'Asia/Almaty', currency: 'KZT' },
  date: '2026-10-07',
  columns: [column('m1', 'Анна'), column('m2', 'Вера')],
  appointments,
  services: [],
  bounds: { fromMinutes: 540, toMinutes: 1260 },
});

describe('Beauty Today', () => {
  it('мастеров столько, сколько столбцов дня; справочник мастеров не нужен', () => {
    expect(beautyToday(day([]), 600).masters).toBe(2);
  });

  it('считает записи дня по статусам; отменённые в «Записей» не входят', () => {
    const m = beautyToday(
      day([
        appointment('a', 'm1', 'BOOKED', 600, 660),
        appointment('b', 'm1', 'CONFIRMED', 700, 760),
        appointment('c', 'm2', 'DONE', 540, 600),
        appointment('d', 'm2', 'NO_SHOW', 540, 600),
        appointment('e', 'm2', 'CANCELLED', 800, 860),
      ]),
      620,
    );
    expect(m).toMatchObject({ appointments: 4, done: 1, noShow: 1, cancelled: 1, unconfirmed: 1 });
  });

  it('впереди: BOOKED и CONFIRMED, ещё не закончились, по времени начала, не больше пяти', () => {
    const rows = [
      appointment('late', 'm1', 'CONFIRMED', 900, 960),
      appointment('over', 'm1', 'BOOKED', 500, 600),
      appointment('now', 'm2', 'BOOKED', 590, 650),
      appointment('done', 'm2', 'DONE', 700, 760),
      appointment('cancel', 'm2', 'CANCELLED', 700, 760),
      ...[1, 2, 3, 4].map((n) => appointment(`x${n}`, 'm1', 'CONFIRMED', 1000 + n, 1100)),
    ];
    const m = beautyToday(day(rows), 600);
    expect(m.remaining).toBe(6);
    expect(m.upcoming.map((u) => u.id)).toEqual(['now', 'late', 'x1', 'x2', 'x3']);
  });

  it('конец ровно в текущую минуту: запись уже не впереди', () => {
    expect(beautyToday(day([appointment('a', 'm1', 'BOOKED', 540, 600)]), 600).upcoming).toEqual(
      [],
    );
  });

  it('мастер записи не в столбцах дня: «Мастер недоступен»', () => {
    const m = beautyToday(
      day([
        appointment('a', 'm1', 'BOOKED', 600, 660),
        appointment('b', 'gone', 'BOOKED', 700, 760),
      ]),
      560,
    );
    expect(m.upcoming.map((u) => u.master)).toEqual(['Анна', 'Мастер недоступен']);
    expect(m.unavailableMaster).toBe(1);
  });
});

const area = (id: string, active = true): DiningArea => ({
  id,
  locationId: 'l',
  name: `Зал ${id}`,
  sortOrder: 0,
  active,
});
const table = (id: string, areaId: string, active = true): DiningTable => ({
  id,
  areaId,
  name: id,
  capacity: 4,
  sortOrder: 0,
  active,
});
const reservation = (
  id: string,
  status: RestaurantReservation['status'],
  startsAt: string,
  endsAt: string,
  tableId: string | null,
  partySize = 2,
): RestaurantReservation =>
  ({
    id,
    status,
    startsAt,
    endsAt,
    partySize,
    table: tableId ? { ...table(tableId, 'a1'), areaName: 'Зал' } : null,
    customer: {
      id: `c-${id}`,
      firstName: `Гость ${id}`,
      lastName: null,
      phone: null,
      status: 'ACTIVE',
    },
  }) as RestaurantReservation;

describe('Food Today', () => {
  const areas = [area('a1'), area('off', false)];
  const tables = [
    table('t1', 'a1'),
    table('t2', 'a1'),
    table('t3', 'a1', false),
    table('t4', 'off'),
  ];
  const now = '2026-10-07T14:00:00.000Z';

  it('сидят сейчас: только SEATED и только внутри [начало, конец)', () => {
    const m = foodToday({
      areas,
      tables,
      today: [
        reservation('s', 'SEATED', '2026-10-07T13:00:00.000Z', '2026-10-07T15:00:00.000Z', 't1'),
        reservation('edge', 'SEATED', '2026-10-07T12:00:00.000Z', now, 't2'),
        reservation('c', 'CONFIRMED', '2026-10-07T13:30:00.000Z', '2026-10-07T15:00:00.000Z', 't2'),
      ],
      previous: [],
      capturedNow: now,
    });
    expect(m.seatedNow).toBe(1);
  });

  it('свободно сейчас: активные столы активных залов минус занятые, стол считается один раз', () => {
    const m = foodToday({
      areas,
      tables,
      today: [
        reservation('a', 'SEATED', '2026-10-07T13:00:00.000Z', '2026-10-07T15:00:00.000Z', 't1'),
        reservation('b', 'BOOKED', '2026-10-07T13:30:00.000Z', '2026-10-07T15:00:00.000Z', 't1'),
        reservation(
          'done',
          'COMPLETED',
          '2026-10-07T13:00:00.000Z',
          '2026-10-07T15:00:00.000Z',
          't2',
        ),
        reservation(
          'inactive',
          'SEATED',
          '2026-10-07T13:00:00.000Z',
          '2026-10-07T15:00:00.000Z',
          't3',
        ),
        reservation(
          'later',
          'CONFIRMED',
          '2026-10-07T15:00:00.000Z',
          '2026-10-07T16:00:00.000Z',
          't2',
        ),
      ],
      previous: [],
      capturedNow: now,
    });
    expect(m.activeTables).toBe(2);
    expect(m.freeNow).toBe(1);
  });

  it('бронь прошлого дня через полночь занимает стол и сидит, но в «Бронирований» дня не входит', () => {
    const late = '2026-10-07T19:30:00.000Z';
    const m = foodToday({
      areas,
      tables,
      today: [
        reservation('t', 'CONFIRMED', '2026-10-07T21:00:00.000Z', '2026-10-07T22:00:00.000Z', 't2'),
      ],
      previous: [
        reservation(
          'night',
          'SEATED',
          '2026-10-06T18:00:00.000Z',
          '2026-10-07T20:00:00.000Z',
          't1',
        ),
      ],
      capturedNow: late,
    });
    expect(m).toMatchObject({ reservations: 1, seatedNow: 1, freeNow: 1 });
  });

  it('бронирования дня без отменённых; гостей в бронях без отменённых и неявок', () => {
    const m = foodToday({
      areas,
      tables,
      today: [
        reservation('a', 'BOOKED', '2026-10-07T15:00:00.000Z', '2026-10-07T16:00:00.000Z', null, 3),
        reservation(
          'b',
          'NO_SHOW',
          '2026-10-07T10:00:00.000Z',
          '2026-10-07T11:00:00.000Z',
          't1',
          5,
        ),
        reservation(
          'c',
          'CANCELLED',
          '2026-10-07T15:00:00.000Z',
          '2026-10-07T16:00:00.000Z',
          't1',
          7,
        ),
        reservation(
          'd',
          'COMPLETED',
          '2026-10-07T10:00:00.000Z',
          '2026-10-07T11:00:00.000Z',
          't1',
          2,
        ),
      ],
      previous: [],
      capturedNow: now,
    });
    expect(m).toMatchObject({
      reservations: 3,
      guests: 5,
      noShow: 1,
      cancelled: 1,
      withoutTable: 1,
    });
  });

  it('впереди: BOOKED и CONFIRMED дня, ещё не закончились, по времени начала, не больше пяти', () => {
    const m = foodToday({
      areas,
      tables,
      today: [
        reservation('past', 'BOOKED', '2026-10-07T12:00:00.000Z', '2026-10-07T13:00:00.000Z', 't1'),
        reservation('z', 'CONFIRMED', '2026-10-07T18:00:00.000Z', '2026-10-07T19:00:00.000Z', 't1'),
        reservation('y', 'BOOKED', '2026-10-07T13:30:00.000Z', '2026-10-07T15:00:00.000Z', null),
        reservation(
          'seated',
          'SEATED',
          '2026-10-07T13:00:00.000Z',
          '2026-10-07T15:00:00.000Z',
          't2',
        ),
        ...[1, 2, 3, 4].map((n) =>
          reservation(
            `n${n}`,
            'CONFIRMED',
            `2026-10-07T19:0${n}:00.000Z`,
            '2026-10-07T21:00:00.000Z',
            't2',
          ),
        ),
      ],
      previous: [],
      capturedNow: now,
    });
    expect(m.upcoming.map((u) => u.id)).toEqual(['y', 'z', 'n1', 'n2', 'n3']);
    expect(m.upcoming[0]).toMatchObject({ guest: 'Гость y', table: null, partySize: 2 });
  });
});

describe('местная минута филиала', () => {
  it('Алматы UTC+5: 23:30 UTC это 04:30 следующего дня', () => {
    expect(localMinute('2026-10-07T23:30:00.000Z', 'Asia/Almaty', '2026-10-08')).toBe(270);
  });
  it('день журнала уже прошёл: впереди ничего; ещё не наступил: впереди всё', () => {
    expect(localMinute('2026-10-07T23:30:00.000Z', 'Asia/Almaty', '2026-10-07')).toBe(1440);
    expect(localMinute('2026-10-07T23:30:00.000Z', 'Asia/Almaty', '2026-10-09')).toBe(-1);
  });
});
