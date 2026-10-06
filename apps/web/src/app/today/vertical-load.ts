import { beautyApi } from '../../lib/api';
import { foodApi } from '../../lib/food-api';
import { completeFoodList, previousDate, validFoodReservation } from '../../lib/food-data';
import type { DiningArea, DiningTable, RestaurantReservation } from '../../lib/food-types';
import { selectedWorkspaceBranch } from '../../lib/workspace-context';
import { localInput } from '../beauty/time';
import { beautyToday, foodToday, localMinute } from './vertical-metrics';

/**
 * Данные экрана «Сегодня» салона и ресторана (MV8). Момент `nowIso` снимается один раз на запрос, все счёты
 * делаются от него и от пояса филиала. Чужих направлений здесь нет: салон зовёт только день журнала, ресторан
 * только залы, столы и брони.
 */

/** Салон: один запрос дня журнала. Дату и пояс решает API (`/beauty/appointments` без даты это сегодня филиала) */
export async function loadBeautyToday(nowIso: string) {
  const day = await beautyApi.day();
  const currentMinute = localMinute(nowIso, day.location.timezone, day.date);
  return { day, currentMinute, metrics: beautyToday(day, currentMinute) };
}

/** Ресторан: день филиала и вчерашний день (брони через полночь), все страницы списков до конца */
export async function loadFoodToday(nowIso: string) {
  const branch = await selectedWorkspaceBranch();
  if (!branch) throw new Error('Выбранный филиал недоступен');
  const date = localInput(nowIso, branch.timezone).slice(0, 10);
  const reservations = (d: string) =>
    completeFoodList<RestaurantReservation>(
      (cursor) => foodApi.reservations(d, cursor),
      validFoodReservation,
    );
  const [areas, tables, today, previous] = await Promise.all([
    completeFoodList<DiningArea>(foodApi.areas),
    completeFoodList<DiningTable>(foodApi.tables),
    reservations(date),
    reservations(previousDate(date)),
  ]);
  return {
    date,
    timezone: branch.timezone,
    branchName: branch.name,
    metrics: foodToday({ areas, tables, today, previous, capturedNow: nowIso }),
  };
}
