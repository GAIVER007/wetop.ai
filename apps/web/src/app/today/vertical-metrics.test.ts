import { describe, expect, it } from 'vitest';
import type { BeautyAppointmentRow, BeautyDay } from '../../lib/api';
import type { DiningArea, DiningTable, RestaurantReservation } from '../../lib/food-types';
import {
  assertSameLocalDay,
  beautyToday,
  DAY_CHANGED_MESSAGE,
  foodToday,
  localMinute,
  UNAVAILABLE_MASTER,
} from './vertical-metrics';

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

describe('Beauty Today: утверждённый набор показателей', () => {
  it('мастеров столько, сколько столбцов дня; справочник мастеров не нужен', () => {
    expect(beautyToday(day([]), 600).masters).toBe(2);
  });

  it('Запланировано = BOOKED + CONFIRMED, Подтверждено = CONFIRMED, Завершено = DONE', () => {
    const m = beautyToday(
      day([
        appointment('a', 'm1', 'BOOKED', 600, 660),
        appointment('b', 'm1', 'CONFIRMED', 700, 760),
        appointment('c', 'm2', 'CONFIRMED', 400, 460),
        appointment('d', 'm2', 'DONE', 540, 600),
        appointment('e', 'm2', 'NO_SHOW', 540, 600),
        appointment('f', 'm2', 'CANCELLED', 800, 860),
      ]),
      620,
    );
    expect(m).toMatchObject({ planned: 3, confirmed: 2, done: 1, masters: 2 });
  });

  it('внимание: BOOKED ждут подтверждения, NO_SHOW отдельно', () => {
    const m = beautyToday(
      day([
        appointment('a', 'm1', 'BOOKED', 600, 660),
        appointment('b', 'm1', 'BOOKED', 300, 360),
        appointment('c', 'm2', 'NO_SHOW', 540, 600),
        appointment('d', 'm2', 'CONFIRMED', 700, 760),
      ]),
      620,
    );
    expect(m).toMatchObject({ awaitingConfirmation: 2, noShow: 1 });
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
    expect(beautyToday(day(rows), 600).upcoming.map((u) => u.id)).toEqual([
      'now',
      'late',
      'x1',
      'x2',
      'x3',
    ]);
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
    expect(m.upcoming.map((u) => u.master)).toEqual(['Анна', UNAVAILABLE_MASTER]);
  });
});

describe('сутки филиала', () => {
  it('Алматы UTC+5: 23:30 UTC это 04:30 следующего дня', () => {
    expect(localMinute('2026-10-07T23:30:00.000Z', 'Asia/Almaty')).toBe(270);
  });

  it('день ответа совпадает с сутками филиала: можно считать', () => {
    expect(() =>
      assertSameLocalDay('2026-10-07T23:30:00.000Z', 'Asia/Almaty', '2026-10-08'),
    ).not.toThrow();
  });

  it('полночь между запросом и счётом: ошибка «обновите», данные разных суток не смешиваются', () => {
    expect(() =>
      assertSameLocalDay('2026-10-07T23:30:00.000Z', 'Asia/Almaty', '2026-10-07'),
    ).toThrow(DAY_CHANGED_MESSAGE);
    expect(() =>
      assertSameLocalDay('2026-10-07T23:30:00.000Z', 'Asia/Almaty', '2026-10-09'),
    ).toThrow(DAY_CHANGED_MESSAGE);
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
  updatedAt = '2026-10-07T00:00:00.000Z',
): RestaurantReservation =>
  ({
    id,
    status,
    startsAt,
    endsAt,
    partySize: 2,
    updatedAt,
    table: tableId ? { ...table(tableId, 'a1'), areaName: 'Зал' } : null,
    customer: {
      id: `c-${id}`,
      firstName: `Гость ${id}`,
      lastName: null,
      phone: null,
      status: 'ACTIVE',
    },
  }) as RestaurantReservation;

describe('Food Today: утверждённый набор показателей', () => {
  const areas = [area('a1'), area('off', false)];
  const tables = [
    table('t1', 'a1'),
    table('t2', 'a1'),
    table('t3', 'a1', false),
    table('t4', 'off'),
  ];
  // полночь 07.10 по Алматы
  const dayStart = '2026-10-06T19:00:00.000Z';
  const now = '2026-10-07T14:00:00.000Z';
  const base = { areas, tables, dayStart, capturedNow: now };

  it('сидят сейчас: только SEATED и только внутри [начало, конец)', () => {
    const m = foodToday({
      ...base,
      today: [
        reservation('s', 'SEATED', '2026-10-07T13:00:00.000Z', '2026-10-07T15:00:00.000Z', 't1'),
        reservation('edge', 'SEATED', '2026-10-07T12:00:00.000Z', now, 't2'),
        reservation('c', 'CONFIRMED', '2026-10-07T13:30:00.000Z', '2026-10-07T15:00:00.000Z', 't2'),
      ],
      previous: [],
    });
    expect(m.seatedNow).toBe(1);
  });

  it('свободно сейчас: активные столы активных залов минус занятые, стол считается один раз', () => {
    const m = foodToday({
      ...base,
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
    });
    expect(m.activeTables).toBe(2);
    expect(m.freeNow).toBe(1);
  });

  it('Запланировано = BOOKED + CONFIRMED дня, Завершено = COMPLETED дня', () => {
    const m = foodToday({
      ...base,
      today: [
        reservation('a', 'BOOKED', '2026-10-07T15:00:00.000Z', '2026-10-07T16:00:00.000Z', null),
        reservation('b', 'CONFIRMED', '2026-10-07T15:00:00.000Z', '2026-10-07T16:00:00.000Z', 't1'),
        reservation('c', 'COMPLETED', '2026-10-07T10:00:00.000Z', '2026-10-07T11:00:00.000Z', 't1'),
        reservation('d', 'NO_SHOW', '2026-10-07T10:00:00.000Z', '2026-10-07T11:00:00.000Z', 't1'),
        reservation('e', 'CANCELLED', '2026-10-07T15:00:00.000Z', '2026-10-07T16:00:00.000Z', 't1'),
      ],
      previous: [
        reservation('y', 'COMPLETED', '2026-10-06T10:00:00.000Z', '2026-10-06T11:00:00.000Z', 't1'),
      ],
    });
    expect(m).toMatchObject({ planned: 2, completed: 1 });
  });

  it('внимание: BOOKED/CONFIRMED без стола, BOOKED ждут подтверждения, NO_SHOW', () => {
    const m = foodToday({
      ...base,
      today: [
        reservation('a', 'BOOKED', '2026-10-07T15:00:00.000Z', '2026-10-07T16:00:00.000Z', null),
        reservation('b', 'CONFIRMED', '2026-10-07T09:00:00.000Z', '2026-10-07T10:00:00.000Z', null),
        reservation('c', 'BOOKED', '2026-10-07T15:00:00.000Z', '2026-10-07T16:00:00.000Z', 't1'),
        reservation('d', 'NO_SHOW', '2026-10-07T10:00:00.000Z', '2026-10-07T11:00:00.000Z', null),
        reservation('e', 'SEATED', '2026-10-07T13:00:00.000Z', '2026-10-07T15:00:00.000Z', 't2'),
      ],
      previous: [],
    });
    expect(m).toMatchObject({ withoutTable: 2, awaitingConfirmation: 2, noShow: 1 });
  });

  it('бронь прошлого дня через полночь занимает стол и сидит, но в показатели дня не входит', () => {
    const late = '2026-10-06T19:30:00.000Z';
    const m = foodToday({
      ...base,
      capturedNow: late,
      today: [
        reservation('t', 'CONFIRMED', '2026-10-07T13:00:00.000Z', '2026-10-07T14:00:00.000Z', 't2'),
      ],
      previous: [
        reservation(
          'night',
          'SEATED',
          '2026-10-06T17:00:00.000Z',
          '2026-10-06T20:00:00.000Z',
          't1',
        ),
      ],
    });
    expect(m).toMatchObject({ planned: 1, seatedNow: 1, freeNow: 1 });
  });

  it('одна бронь в обоих ответах: берётся строка с более новым updatedAt', () => {
    const moved = (updatedAt: string, startsAt: string, status: RestaurantReservation['status']) =>
      reservation('r', status, startsAt, '2026-10-07T16:00:00.000Z', null, updatedAt);
    // свежее вчерашнего ответа: бронь перенесли на вчера и посадили, в день не входит
    const fresherPrevious = foodToday({
      ...base,
      today: [moved('2026-10-07T10:00:00.000Z', '2026-10-07T15:00:00.000Z', 'BOOKED')],
      previous: [moved('2026-10-07T11:00:00.000Z', '2026-10-06T18:00:00.000Z', 'SEATED')],
    });
    expect(fresherPrevious).toMatchObject({ planned: 0, seatedNow: 1 });
    // свежее сегодняшнего ответа: побеждает сегодняшняя строка
    const fresherToday = foodToday({
      ...base,
      today: [moved('2026-10-07T12:00:00.000Z', '2026-10-07T15:00:00.000Z', 'BOOKED')],
      previous: [moved('2026-10-07T11:00:00.000Z', '2026-10-06T18:00:00.000Z', 'SEATED')],
    });
    expect(fresherToday).toMatchObject({ planned: 1, seatedNow: 0 });
  });

  it('впереди: BOOKED и CONFIRMED дня, окно ещё не закончилось, по времени начала, не больше пяти', () => {
    const m = foodToday({
      ...base,
      today: [
        reservation('past', 'BOOKED', '2026-10-07T12:00:00.000Z', '2026-10-07T13:00:00.000Z', 't1'),
        reservation('z', 'CONFIRMED', '2026-10-07T18:00:00.000Z', '2026-10-07T19:00:00.000Z', 't1'),
        // началась, но окно ещё идёт и гость не сел: остаётся на виду
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
    });
    expect(m.upcoming.map((u) => u.id)).toEqual(['y', 'z', 'n1', 'n2', 'n3']);
    expect(m.upcoming[0]).toMatchObject({ guest: 'Гость y', table: null, partySize: 2 });
  });
});
