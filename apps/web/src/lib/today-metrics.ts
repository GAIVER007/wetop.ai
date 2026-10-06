import type { BeautyDay } from './api';
import type { DiningArea, DiningTable, RestaurantReservation } from './food-types';
import { occupiedAt } from './food-data';
import { propertyClock } from './property-time';

export function beautyTodayMetrics(day: BeautyDay, minute: number) {
  const active = day.appointments.filter((r) => r.status === 'BOOKED' || r.status === 'CONFIRMED');
  return {
    planned: active.length,
    confirmed: day.appointments.filter((r) => r.status === 'CONFIRMED').length,
    completed: day.appointments.filter((r) => r.status === 'DONE').length,
    masters: day.columns.length,
    confirmation: day.appointments.filter((r) => r.status === 'BOOKED'),
    noShow: day.appointments.filter((r) => r.status === 'NO_SHOW').length,
    upcoming: active
      .sort(
        (a, b) =>
          Number(b.endMinutes > minute) - Number(a.endMinutes > minute) ||
          a.startMinutes - b.startMinutes ||
          a.id.localeCompare(b.id),
      )
      .slice(0, 5),
  };
}

export function foodTodayMetrics(
  rows: RestaurantReservation[],
  areas: Pick<DiningArea, 'id' | 'active'>[],
  tables: Pick<DiningTable, 'id' | 'areaId' | 'active'>[],
  timezone: string,
  now: Date,
) {
  const clock = propertyClock(timezone);
  const date = clock.today(now);
  const all = [...new Map(rows.map((r) => [r.id, r])).values()];
  const today = all.filter((r) => clock.date(r.startsAt) === date);
  const active = today.filter((r) => r.status === 'BOOKED' || r.status === 'CONFIRMED');
  const activeAreas = new Set(areas.filter((a) => a.active).map((a) => a.id));
  const activeTables = new Set(
    tables.filter((t) => t.active && activeAreas.has(t.areaId)).map((t) => t.id),
  );
  const occupied = new Set(
    all
      .filter((r) => occupiedAt(r, now.toISOString()) && r.table && activeTables.has(r.table.id))
      .map((r) => r.table!.id),
  );
  const seated = all
    .filter((r) => r.status === 'SEATED' && occupiedAt(r, now.toISOString()))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id.localeCompare(b.id));
  return {
    date,
    planned: active.length,
    completed: today.filter((r) => r.status === 'COMPLETED').length,
    seatedCount: seated.length,
    freeNow: activeTables.size - occupied.size,
    noShow: today.filter((r) => r.status === 'NO_SHOW').length,
    unassigned: active.filter((r) => !r.table),
    confirmation: today.filter((r) => r.status === 'BOOKED'),
    seated: seated.slice(0, 5),
    upcoming: active
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id.localeCompare(b.id))
      .slice(0, 5),
  };
}
