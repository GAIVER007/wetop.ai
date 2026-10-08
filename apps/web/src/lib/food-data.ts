import type { FoodPage } from './food-types';
import { foodStatus } from './status/food';
/** A truncated dataset must never imply that the remaining tables are free. */
export async function completeFoodList<T extends { id: string }>(
  load: (cursor?: string) => Promise<FoodPage<T> | unknown>,
  valid: (item: unknown) => boolean = () => true,
): Promise<T[]> {
  let cursor: string | undefined;
  const cursors = new Set<string>();
  const items = new Map<string, T>();
  for (let page = 0; page < 1000; page++) {
    const raw = await load(cursor);
    if (
      !raw ||
      typeof raw !== 'object' ||
      !('items' in raw) ||
      !Array.isArray(raw.items) ||
      !('nextCursor' in raw) ||
      (raw.nextCursor !== null && typeof raw.nextCursor !== 'string')
    )
      throw new Error('Не удалось загрузить полный список. Обновите страницу.');
    for (const item of raw.items) {
      if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !valid(item))
        throw new Error('Некорректный ответ списка');
      items.set(item.id, item as T);
    }
    if (raw.nextCursor === null) return [...items.values()];
    if (!raw.items.length || !raw.nextCursor || cursors.has(raw.nextCursor))
      throw new Error('Повтор страницы списка. Обновите страницу.');
    cursors.add(raw.nextCursor);
    cursor = raw.nextCursor;
  }
  throw new Error('Не удалось загрузить полный список. Обновите страницу.');
}
export function occupiedAt(
  r: { status: string; startsAt: string; endsAt: string },
  selected: string,
): boolean {
  const at = Date.parse(selected);
  return (
    ['BOOKED', 'CONFIRMED', 'SEATED'].includes(r.status) &&
    Date.parse(r.startsAt) <= at &&
    at < Date.parse(r.endsAt)
  );
}
export function previousDate(date: string): string {
  return shiftDate(date, -1);
}
export function shiftDate(date: string, days: number): string {
  const at = new Date(`${date}T12:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}
/** status-hint: глагол кнопки перехода, а не слово статуса; статусы в `lib/status/food` */
export const foodStatusActions = {
  BOOKED: 'Бронь',
  CONFIRMED: 'Подтвердить',
  SEATED: 'Посадить',
  COMPLETED: 'Завершить',
  NO_SHOW: 'Не пришли',
  CANCELLED: 'Отменить',
} as const;
export const weekdays = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export function validFoodReservation(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.status === 'string' &&
    Object.hasOwn(foodStatus, r.status) &&
    typeof r.startsAt === 'string' &&
    typeof r.endsAt === 'string' &&
    Number.isFinite(Date.parse(r.startsAt)) &&
    Date.parse(r.endsAt) > Date.parse(r.startsAt) &&
    (r.table === null ||
      (!!r.table &&
        typeof r.table === 'object' &&
        'id' in r.table &&
        typeof r.table.id === 'string' &&
        'areaId' in r.table &&
        typeof r.table.areaId === 'string')) &&
    !!r.customer &&
    typeof r.customer === 'object' &&
    'firstName' in r.customer &&
    typeof r.customer.firstName === 'string' &&
    Number.isInteger(r.partySize) &&
    !!r.servicePeriod &&
    typeof r.servicePeriod === 'object' &&
    'id' in r.servicePeriod &&
    typeof r.servicePeriod.id === 'string' &&
    'name' in r.servicePeriod &&
    typeof r.servicePeriod.name === 'string' &&
    typeof r.updatedAt === 'string' &&
    Number.isFinite(Date.parse(r.updatedAt)) &&
    Array.isArray(r.nextStatuses) &&
    r.nextStatuses.every(
      (status) => typeof status === 'string' && Object.hasOwn(foodStatus, status),
    )
  );
}
