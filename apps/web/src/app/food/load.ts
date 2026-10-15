import { requireVertical } from '../../lib/vertical-guard';
import { deskShell } from '../../lib/desk-shell';
import { selectedWorkspaceBranch } from '../../lib/workspace-context';
import { foodApi, restaurantApi } from '../../lib/food-api';
import { completeFoodList, previousDate, validFoodReservation } from '../../lib/food-data';
import type {
  DiningArea,
  DiningTable,
  FoodCustomer,
  OrderView,
  ServicePeriod,
  RestaurantReservation,
  FoodWorkspace,
} from '../../lib/food-types';
import { mayAccess } from '../../lib/navigation';
import { localInput } from '../beauty/time';
export async function loadFood(
  dateParam?: string,
  timeParam?: string,
  day = false,
  withOrders = false,
): Promise<FoodWorkspace> {
  const me = await requireVertical(['FOOD_SERVICE']);
  if (me.context?.vertical !== 'FOOD_SERVICE' || !me.context.businessId || !me.context.locationId)
    throw new Error('Выберите ресторан и филиал');
  const [shell, branch] = await Promise.all([deskShell(), selectedWorkspaceBranch()]);
  if (!branch) throw new Error('Выбранный филиал недоступен');
  const timezone = branch.timezone;
  const local = localInput(new Date().toISOString(), timezone);
  const date =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) && !Number.isNaN(Date.parse(dateParam))
      ? dateParam
      : local.slice(0, 10);
  const [areas, tables, periods, customers] = await Promise.all([
    completeFoodList<DiningArea>(foodApi.areas),
    completeFoodList<DiningTable>(foodApi.tables),
    completeFoodList<ServicePeriod>(foodApi.periods),
    completeFoodList<FoodCustomer>(foodApi.customers),
  ]);
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const first = periods
    .filter((p) => p.active && p.weekday === weekday)
    .sort((a, b) => a.timeFrom.localeCompare(b.timeFrom))[0];
  const time =
    timeParam && /^([01]\d|2[0-3]):[0-5]\d$/.test(timeParam)
      ? timeParam
      : date === local.slice(0, 10)
        ? local.slice(11, 16)
        : (first?.timeFrom ?? '12:00');
  const days = day ? [date] : [date, previousDate(date)];
  const [lists, orders] = await Promise.all([
    Promise.all(
      days.map((d) =>
        completeFoodList<RestaurantReservation>(
          (cursor) => foodApi.reservations(d, cursor),
          validFoodReservation,
        ),
      ),
    ),
    withOrders
      ? completeFoodList<OrderView>((cursor) => restaurantApi.openOrders(cursor))
      : Promise.resolve(undefined),
  ]);
  return {
    ...(orders ? { orders } : {}),
    areas,
    tables,
    periods,
    customers,
    reservations: [...new Map(lists.flat().map((r) => [r.id, r])).values()],
    date,
    time,
    timezone,
    scopeKey: `${me.context.businessId}:${me.context.locationId}`,
    readOnly: shell.readOnly,
    canDesk: mayAccess(shell.access, 'desk'),
    canProperty: mayAccess(shell.access, 'property'),
  };
}
