import type { BeautyDay } from './api';
import type { foodApi } from './food-api';
import { completeFoodList, previousDate, validFoodReservation } from './food-data';
import type { DiningArea, DiningTable, RestaurantReservation } from './food-types';
import { propertyClock } from './property-time';
import type { WebVertical } from './vertical-landing';

/** Only the server-verified context selects a domain; shell fallbacks are not evidence. */
export function verifiedTodayScope(me: unknown): {
  vertical: WebVertical;
  businessId: string;
  locationId: string;
} {
  if (
    !me ||
    typeof me !== 'object' ||
    !('user' in me) ||
    !me.user ||
    typeof me.user !== 'object' ||
    Array.isArray(me.user) ||
    !('context' in me) ||
    !me.context ||
    typeof me.context !== 'object' ||
    Array.isArray(me.context)
  )
    throw new Error(
      'Не удалось определить выбранный филиал. Выберите филиал и повторите загрузку.',
    );
  const c = me.context as Record<string, unknown>;
  if (
    typeof c.vertical !== 'string' ||
    !['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'].includes(c.vertical) ||
    typeof c.businessId !== 'string' ||
    !c.businessId ||
    typeof c.locationId !== 'string' ||
    !c.locationId
  )
    throw new Error(
      'Не удалось определить выбранный филиал. Выберите филиал и повторите загрузку.',
    );
  return {
    vertical: c.vertical as WebVertical,
    businessId: c.businessId,
    locationId: c.locationId,
  };
}

function strictClock(timezone: string) {
  if (typeof timezone !== 'string' || !timezone)
    throw new Error('Не удалось определить часовой пояс филиала');
  new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format();
  return propertyClock(timezone);
}
export async function loadBeautyToday(
  read: () => Promise<BeautyDay>,
  locationId: string,
  clockNow = () => new Date(),
) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const day = await read();
    const now = clockNow();
    if (
      !day?.location ||
      day.location.id !== locationId ||
      !Array.isArray(day.columns) ||
      !Array.isArray(day.appointments) ||
      !day.columns.every((c) => c && typeof c.id === 'string' && typeof c.name === 'string') ||
      !day.appointments.every(
        (r) =>
          r &&
          typeof r.id === 'string' &&
          typeof r.employeeId === 'string' &&
          typeof r.serviceName === 'string' &&
          typeof r.customer?.name === 'string' &&
          Number.isFinite(r.startMinutes) &&
          Number.isFinite(r.endMinutes) &&
          Number.isFinite(Date.parse(r.startsAt)) &&
          Number.isFinite(Date.parse(r.endsAt)) &&
          ['BOOKED', 'CONFIRMED', 'DONE', 'NO_SHOW', 'CANCELLED'].includes(r.status),
      )
    )
      throw new Error('Некорректный ответ записей филиала');
    const clock = strictClock(day.location.timezone);
    if (clock.today(now) !== day.date) continue;
    const [hour, minute] = clock.clock(now.toISOString()).split(':').map(Number);
    return { day, minute: hour! * 60 + minute! };
  }
  throw new Error('Смена локального дня. Повторите загрузку записей.');
}
export async function loadFoodToday(
  api: Pick<typeof foodApi, 'areas' | 'tables' | 'reservations'>,
  timezone: string,
  now = new Date(),
  validReservation = validFoodReservation,
) {
  const date = strictClock(timezone).today(now);
  const [areas, tables, today, yesterday] = await Promise.all([
    completeFoodList<DiningArea>(
      (cursor) => api.areas(cursor),
      (raw) =>
        !!raw &&
        typeof raw === 'object' &&
        'active' in raw &&
        typeof raw.active === 'boolean' &&
        'name' in raw &&
        typeof raw.name === 'string',
    ),
    completeFoodList<DiningTable>(
      (cursor) => api.tables(cursor),
      (raw) =>
        !!raw &&
        typeof raw === 'object' &&
        'active' in raw &&
        typeof raw.active === 'boolean' &&
        'areaId' in raw &&
        typeof raw.areaId === 'string' &&
        'name' in raw &&
        typeof raw.name === 'string',
    ),
    completeFoodList<RestaurantReservation>(
      (cursor) => api.reservations(date, cursor),
      validReservation,
    ),
    completeFoodList<RestaurantReservation>(
      (cursor) => api.reservations(previousDate(date), cursor),
      validReservation,
    ),
  ]);
  return {
    areas,
    tables,
    rows: [...new Map([...yesterday, ...today].map((r) => [r.id, r])).values()],
    timezone,
    now,
    date,
  };
}
