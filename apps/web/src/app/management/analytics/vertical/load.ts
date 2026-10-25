import { unstable_rethrow } from 'next/navigation';
import {
  branchFoodPeriod,
  branchReportDay,
  type BranchItem,
  type BeautyDay,
} from '../../../../lib/api';
import type { FoodPage, RestaurantReservation } from '../../../../lib/food-types';
import { completeFoodList, validFoodReservation } from '../../../../lib/food-data';
import { localInput } from '../../../beauty/time';
import { beautyPeriod, foodPeriod } from './metrics';
import { msg } from '../../../../i18n';
export async function loadBranchPeriod(
  branch: Pick<BranchItem, 'id' | 'locationId' | 'vertical' | 'name' | 'timezone' | 'location'>,
  dates: string[],
) {
  // Sequential days bound API/DB concurrency. No module/global report cache.
  const beautyRows: BeautyDay['appointments'] = [];
  const beautyDays: BeautyDay[] = [];
  const foodRows: RestaurantReservation[] = [];
  for (const date of dates) {
    if (branch.vertical === 'BEAUTY') {
      const day = (await branchReportDay(branch, date)) as BeautyDay;
      if (
        day.date !== date ||
        day.location.id !== branch.locationId ||
        day.location.timezone !== branch.timezone ||
        !Array.isArray(day.appointments)
      )
        throw new Error(msg('Контекст отчёта изменился. Обновите страницу.'));
      for (const row of day.appointments) {
        if (localInput(row.startsAt, branch.timezone).slice(0, 10) !== date)
          throw new Error(msg('Некорректная дата записи'));
        beautyRows.push(row);
      }
      beautyDays.push(day);
    } else if (branch.vertical === 'FOOD_SERVICE') {
      const rows = await completeFoodList<RestaurantReservation>(
        (cursor) =>
          branchReportDay(branch, date, cursor) as Promise<FoodPage<RestaurantReservation>>,
        validFoodReservation,
      );
      if (rows.some((row) => row.locationId !== branch.locationId))
        throw new Error(msg('Контекст отчёта изменился. Обновите страницу.'));
      // Food day reads include overlaps. Period counts belong to the reservation's local start date.
      foodRows.push(
        ...rows.filter((row) => localInput(row.startsAt, branch.timezone).slice(0, 10) === date),
      );
    } else throw new Error(msg('Нет адаптера отчёта'));
  }
  if (branch.vertical === 'BEAUTY')
    return { ...beautyPeriod(beautyRows), food: null, days: beautyDays };
  return {
    counts: foodPeriod(foodRows),
    revenue: null,
    food: await branchFoodPeriod(branch, dates[0]!, dates[dates.length - 1]!),
    days: [] as BeautyDay[],
  };
}

/**
 * Прошлый отрезок той же длины для сравнения плиток пульта (вариант A, 25.10.2026). Сбой не роняет экран: без
 * сравнения плитки показывают «—». Салону нужны дни журнала, ресторану только отчёт периода.
 */
export async function loadPreviousPeriod(
  branch: Pick<BranchItem, 'id' | 'locationId' | 'vertical' | 'name' | 'timezone' | 'location'>,
  dates: string[],
) {
  try {
    if (branch.vertical === 'FOOD_SERVICE')
      return {
        food: await branchFoodPeriod(branch, dates[0]!, dates[dates.length - 1]!),
        days: [] as BeautyDay[],
      };
    return { food: null, days: (await loadBranchPeriod(branch, dates)).days };
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
}
