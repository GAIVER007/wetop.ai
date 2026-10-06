import type { BeautyAppointmentRow, BeautyDay } from '../../lib/api';
import type { DiningArea, DiningTable, RestaurantReservation } from '../../lib/food-types';
import { occupiedAt } from '../../lib/food-data';
import { localInput } from '../beauty/time';

/**
 * Показатели экрана «Сегодня» салона и ресторана (MV8, набор утверждён владельцем). Только счёт статусов из
 * ответов API за один день филиала: новых правил брони и денег здесь нет, статусы те же, что у журнала и
 * плана зала.
 */

const UPCOMING_LIMIT = 5;
const ACTIVE_BEAUTY = new Set<BeautyAppointmentRow['status']>(['BOOKED', 'CONFIRMED']);
const ACTIVE_FOOD = new Set<RestaurantReservation['status']>(['BOOKED', 'CONFIRMED']);
export const UNAVAILABLE_MASTER = 'Мастер недоступен';
export const DAY_CHANGED_MESSAGE = 'Сутки филиала сменились. Обновите страницу.';

/** Текущая минута суток филиала */
export function localMinute(nowIso: string, timezone: string): number {
  const local = localInput(nowIso, timezone);
  return Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16));
}

/**
 * Момент счёта и день ответа API должны быть одними сутками филиала. Полночь между запросом и счётом даёт
 * ошибку «обновите», а не числа, смешанные из двух суток.
 */
export function assertSameLocalDay(nowIso: string, timezone: string, date: string): void {
  if (localInput(nowIso, timezone).slice(0, 10) !== date) throw new Error(DAY_CHANGED_MESSAGE);
}

export interface BeautyUpcoming {
  id: string;
  startMinutes: number;
  endMinutes: number;
  customer: string;
  service: string;
  master: string;
  status: BeautyAppointmentRow['status'];
}

export function beautyToday(day: BeautyDay, currentLocalMinute: number) {
  const masters = new Map(day.columns.map((c) => [c.id, c.name]));
  const rows = day.appointments;
  const count = (status: BeautyAppointmentRow['status']) =>
    rows.filter((r) => r.status === status).length;
  const ahead = rows
    .filter((r) => ACTIVE_BEAUTY.has(r.status) && r.endMinutes > currentLocalMinute)
    .sort((a, b) => a.startMinutes - b.startMinutes || a.id.localeCompare(b.id));
  return {
    planned: count('BOOKED') + count('CONFIRMED'),
    confirmed: count('CONFIRMED'),
    done: count('DONE'),
    masters: day.columns.length,
    awaitingConfirmation: count('BOOKED'),
    noShow: count('NO_SHOW'),
    upcoming: ahead.slice(0, UPCOMING_LIMIT).map(
      (r): BeautyUpcoming => ({
        id: r.id,
        startMinutes: r.startMinutes,
        endMinutes: r.endMinutes,
        customer: r.customer.name,
        service: r.serviceName,
        master: masters.get(r.employeeId) ?? UNAVAILABLE_MASTER,
        status: r.status,
      }),
    ),
  };
}

export interface FoodUpcoming {
  id: string;
  startsAt: string;
  guest: string;
  partySize: number;
  table: string | null;
  status: RestaurantReservation['status'];
}

/**
 * `today` это ответ `GET /food-service/reservations?date=` за день филиала, `previous` за вчера: он нужен только
 * тем, кто сидит через полночь. Одна бронь в обоих ответах (её перенесли между запросами) берётся по более новому
 * `updatedAt`; к дню относится та, что начинается не раньше местной полуночи `dayStart`.
 */
export function foodToday(input: {
  areas: DiningArea[];
  tables: DiningTable[];
  today: RestaurantReservation[];
  previous: RestaurantReservation[];
  dayStart: string;
  capturedNow: string;
}) {
  const now = Date.parse(input.capturedNow);
  const activeAreas = new Set(input.areas.filter((a) => a.active).map((a) => a.id));
  const active = new Set(
    input.tables.filter((t) => t.active && activeAreas.has(t.areaId)).map((t) => t.id),
  );
  const byId = new Map<string, RestaurantReservation>();
  for (const r of [...input.previous, ...input.today]) {
    const seen = byId.get(r.id);
    if (!seen || Date.parse(r.updatedAt) >= Date.parse(seen.updatedAt)) byId.set(r.id, r);
  }
  const all = [...byId.values()];
  const dayStart = Date.parse(input.dayStart);
  const day = all.filter((r) => Date.parse(r.startsAt) >= dayStart);
  const count = (status: RestaurantReservation['status']) =>
    day.filter((r) => r.status === status).length;
  const occupied = new Set(
    all
      .filter((r) => r.table && active.has(r.table.id) && occupiedAt(r, input.capturedNow))
      .map((r) => r.table!.id),
  );
  const ahead = day
    .filter((r) => ACTIVE_FOOD.has(r.status) && Date.parse(r.endsAt) > now)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id.localeCompare(b.id));
  return {
    planned: count('BOOKED') + count('CONFIRMED'),
    seatedNow: all.filter(
      (r) => r.status === 'SEATED' && Date.parse(r.startsAt) <= now && now < Date.parse(r.endsAt),
    ).length,
    completed: count('COMPLETED'),
    activeTables: active.size,
    freeNow: active.size - occupied.size,
    withoutTable: day.filter((r) => ACTIVE_FOOD.has(r.status) && !r.table).length,
    awaitingConfirmation: count('BOOKED'),
    noShow: count('NO_SHOW'),
    upcoming: ahead.slice(0, UPCOMING_LIMIT).map(
      (r): FoodUpcoming => ({
        id: r.id,
        startsAt: r.startsAt,
        guest: [r.customer.firstName, r.customer.lastName].filter(Boolean).join(' '),
        partySize: r.partySize,
        table: r.table?.name ?? null,
        status: r.status,
      }),
    ),
  };
}
