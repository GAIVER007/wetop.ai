import type { BeautyAppointmentRow, BeautyDay } from '../../lib/api';
import type { DiningArea, DiningTable, RestaurantReservation } from '../../lib/food-types';
import { occupiedAt } from '../../lib/food-data';
import { localInput } from '../beauty/time';

/**
 * Показатели экрана «Сегодня» салона и ресторана (MV8). Только счёт по ответам API за один день филиала:
 * новых правил брони и денег здесь нет, статусы те же, что у журнала и плана зала.
 */

const UPCOMING_LIMIT = 5;
const ACTIVE_BEAUTY = new Set<BeautyAppointmentRow['status']>(['BOOKED', 'CONFIRMED']);
const ACTIVE_FOOD = new Set<RestaurantReservation['status']>(['BOOKED', 'CONFIRMED']);
export const UNAVAILABLE_MASTER = 'Мастер недоступен';

/**
 * Текущая минута суток филиала относительно дня, который отдал API. День уже прошёл: 1440 (впереди ничего),
 * ещё не наступил: -1 (впереди всё). Так полночь между запросом и счётом не даёт чужих чисел.
 */
export function localMinute(nowIso: string, timezone: string, date: string): number {
  const local = localInput(nowIso, timezone);
  const today = local.slice(0, 10);
  if (today > date) return 1440;
  if (today < date) return -1;
  return Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16));
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
    masters: day.columns.length,
    appointments: rows.length - count('CANCELLED'),
    done: count('DONE'),
    noShow: count('NO_SHOW'),
    cancelled: count('CANCELLED'),
    unconfirmed: ahead.filter((r) => r.status === 'BOOKED').length,
    unavailableMaster: ahead.filter((r) => !masters.has(r.employeeId)).length,
    remaining: ahead.length,
    upcoming: ahead.slice(0, UPCOMING_LIMIT).map((r): BeautyUpcoming => ({
      id: r.id,
      startMinutes: r.startMinutes,
      endMinutes: r.endMinutes,
      customer: r.customer.name,
      service: r.serviceName,
      master: masters.get(r.employeeId) ?? UNAVAILABLE_MASTER,
      status: r.status,
    })),
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
 * `today` это брони, начатые в этот день филиала (ответ `GET /food-service/reservations?date=`), `previous`
 * брони прошлого дня: они нужны только для тех, кто сидит через полночь, в счёт дня не входят.
 */
export function foodToday(input: {
  areas: DiningArea[];
  tables: DiningTable[];
  today: RestaurantReservation[];
  previous: RestaurantReservation[];
  capturedNow: string;
}) {
  const now = Date.parse(input.capturedNow);
  const activeAreas = new Set(input.areas.filter((a) => a.active).map((a) => a.id));
  const active = new Set(
    input.tables.filter((t) => t.active && activeAreas.has(t.areaId)).map((t) => t.id),
  );
  const byId = new Map([...input.previous, ...input.today].map((r) => [r.id, r]));
  const all = [...byId.values()];
  const occupied = new Set(
    all
      .filter((r) => r.table && active.has(r.table.id) && occupiedAt(r, input.capturedNow))
      .map((r) => r.table!.id),
  );
  const day = input.today;
  const count = (status: RestaurantReservation['status']) =>
    day.filter((r) => r.status === status).length;
  const ahead = day
    .filter((r) => ACTIVE_FOOD.has(r.status) && Date.parse(r.endsAt) > now)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id.localeCompare(b.id));
  return {
    reservations: day.length - count('CANCELLED'),
    guests: day
      .filter((r) => r.status !== 'CANCELLED' && r.status !== 'NO_SHOW')
      .reduce((sum, r) => sum + r.partySize, 0),
    noShow: count('NO_SHOW'),
    cancelled: count('CANCELLED'),
    seatedNow: all.filter(
      (r) => r.status === 'SEATED' && Date.parse(r.startsAt) <= now && now < Date.parse(r.endsAt),
    ).length,
    activeTables: active.size,
    freeNow: active.size - occupied.size,
    withoutTable: ahead.filter((r) => !r.table).length,
    upcoming: ahead.slice(0, UPCOMING_LIMIT).map((r): FoodUpcoming => ({
      id: r.id,
      startsAt: r.startsAt,
      guest: [r.customer.firstName, r.customer.lastName].filter(Boolean).join(' '),
      partySize: r.partySize,
      table: r.table?.name ?? null,
      status: r.status,
    })),
  };
}
