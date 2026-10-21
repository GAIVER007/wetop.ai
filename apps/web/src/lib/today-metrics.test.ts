import { describe, it, expect } from 'vitest';
import { beautyTodayMetrics, foodTodayMetrics } from './today-metrics';
import type { BeautyDay, BeautyAppointmentRow } from './api';
import type { RestaurantReservation } from './food-types';
const appointment = (
  id: string,
  status: BeautyAppointmentRow['status'],
  startMinutes = 600,
  endMinutes = 660,
) => ({ id, status, startMinutes, endMinutes }) as BeautyAppointmentRow;
const day = {
  columns: [{ id: 'master' }],
  appointments: [
    appointment('b1', 'BOOKED', 500, 550),
    appointment('b2', 'BOOKED', 650, 700),
    appointment('c', 'CONFIRMED', 590, 630),
    appointment('d', 'DONE'),
    appointment('n', 'NO_SHOW'),
    appointment('x', 'CANCELLED'),
  ],
} as BeautyDay;
const reservation = (
  id: string,
  status: RestaurantReservation['status'],
  startsAt = '2026-10-05T00:00:00Z',
  endsAt = '2026-10-05T02:00:00Z',
  tableId: string | null = 't',
) =>
  ({
    id,
    status,
    startsAt,
    endsAt,
    table: tableId ? { id: tableId } : null,
  }) as RestaurantReservation;
describe('MV8 Beauty facts', () => {
  it('uses exact statuses and real columns, future/current first then past', () => {
    const m = beautyTodayMetrics(day, 600);
    expect(m).toMatchObject({ planned: 3, confirmed: 1, completed: 1, masters: 1, noShow: 1 });
    expect(m.confirmation.map((r) => r.id)).toEqual(['b1', 'b2']);
    expect(m.upcoming.map((r) => r.id)).toEqual(['c', 'b2', 'b1']);
  });
  it('limits to five with deterministic start order and excludes terminal', () => {
    expect(
      beautyTodayMetrics(
        {
          ...day,
          appointments: Array.from({ length: 9 }, (_, i) =>
            appointment(String(i), 'BOOKED', i, 100),
          ),
        },
        10,
      ).upcoming.map((r) => r.id),
    ).toEqual(['0', '1', '2', '3', '4']);
  });
});
describe('MV8 Food facts', () => {
  const now = new Date('2026-10-04T20:30:00Z');
  const rows = [
    reservation('night', 'SEATED', '2026-10-04T19:30:00Z', '2026-10-04T21:30:00Z'),
    reservation('b', 'BOOKED', '2026-10-04T20:00:00Z', '2026-10-04T22:00:00Z', null),
    reservation('c', 'CONFIRMED', '2026-10-04T20:00:00Z', '2026-10-04T22:00:00Z'),
    reservation('done', 'COMPLETED', '2026-10-04T20:00:00Z'),
    reservation('no', 'NO_SHOW', '2026-10-04T20:00:00Z'),
    reservation('cancel', 'CANCELLED', '2026-10-04T20:00:00Z'),
    reservation('old', 'SEATED', '2026-10-03T20:00:00Z', '2026-10-04T20:30:00Z'),
  ];
  const areas = [
    { id: 'a', active: true },
    { id: 'off', active: false },
  ];
  const tables = [
    { id: 't', areaId: 'a', active: true },
    { id: 'free', areaId: 'a', active: true },
    { id: 'off', areaId: 'off', active: true },
    { id: 'inactive', areaId: 'a', active: false },
  ];
  it('uses local start date, overnight intervals, active areas and distinct occupied tables', () => {
    const m = foodTodayMetrics(rows, areas, tables, 'Asia/Dubai', now);
    expect(m).toMatchObject({ planned: 2, completed: 1, seatedCount: 1, freeNow: 1, noShow: 1 });
    expect(m.unassigned.map((r) => r.id)).toEqual(['b']);
    expect(m.confirmation.map((r) => r.id)).toEqual(['b']);
    expect(m.seated.map((r) => r.id)).toEqual(['night']);
  });
  it('deduplicates both days and honors end exclusive boundary', () => {
    const m = foodTodayMetrics(
      [...rows, rows[0]!],
      areas,
      tables,
      'Asia/Dubai',
      new Date('2026-10-04T21:30:00Z'),
    );
    expect(m.seatedCount).toBe(0);
    expect(m.freeNow).toBe(1);
  });
  it('terminal statuses never occupy, caps and sorts upcoming', () => {
    const m = foodTodayMetrics(
      [
        reservation('done', 'COMPLETED'),
        ...Array.from({ length: 8 }, (_, i) =>
          reservation(String(i), 'BOOKED', `2026-10-05T0${i}:00:00Z`),
        ),
      ],
      areas,
      tables,
      'UTC',
      new Date('2026-10-05T01:00:00Z'),
    );
    expect(m.upcoming).toHaveLength(5);
    expect(m.upcoming.map((r) => r.id)).toEqual(['0', '1', '2', '3', '4']);
  });
});
