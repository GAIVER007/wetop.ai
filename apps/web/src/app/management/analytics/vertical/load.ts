import { branchReportDay, type BranchItem, type BeautyDay } from '../../../../lib/api';
import type { FoodPage, RestaurantReservation } from '../../../../lib/food-types';
import { completeFoodList, validFoodReservation } from '../../../../lib/food-data';
import { localInput } from '../../../beauty/time';
import { beautyPeriod, foodPeriod } from './metrics';
export async function loadBranchPeriod(
  branch: Pick<BranchItem, 'id' | 'locationId' | 'vertical' | 'name' | 'timezone' | 'location'>,
  dates: string[],
) {
  // Sequential days bound API/DB concurrency. No module/global report cache.
  const beautyRows: BeautyDay['appointments'] = [];
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
        throw new Error('Контекст отчёта изменился. Обновите страницу.');
      for (const row of day.appointments) {
        if (localInput(row.startsAt, branch.timezone).slice(0, 10) !== date)
          throw new Error('Некорректная дата записи');
        beautyRows.push(row);
      }
    } else if (branch.vertical === 'FOOD_SERVICE') {
      const rows = await completeFoodList<RestaurantReservation>(
        (cursor) =>
          branchReportDay(branch, date, cursor) as Promise<FoodPage<RestaurantReservation>>,
        validFoodReservation,
      );
      if (rows.some((row) => row.locationId !== branch.locationId))
        throw new Error('Контекст отчёта изменился. Обновите страницу.');
      // Food day reads include overlaps. Period counts belong to the reservation's local start date.
      foodRows.push(
        ...rows.filter((row) => localInput(row.startsAt, branch.timezone).slice(0, 10) === date),
      );
    } else throw new Error('Нет адаптера отчёта');
  }
  if (branch.vertical === 'BEAUTY') return beautyPeriod(beautyRows);
  return { counts: foodPeriod(foodRows), revenue: null };
}
