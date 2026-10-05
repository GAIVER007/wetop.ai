'use server';
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { ApiError } from '../../lib/api';
import { currentMe } from '../../lib/desk-shell';
import { foodApi } from '../../lib/food-api';
import type {
  AreaInput,
  FoodStatus,
  FoodToken,
  PeriodInput,
  ReservationInput,
  ReservationPatch,
  RestaurantReservation,
  TableInput,
} from '../../lib/food-types';
type CatalogCommand =
  | { kind: 'area'; id?: string; body: AreaInput }
  | { kind: 'table'; id?: string; body: TableInput }
  | { kind: 'period'; id?: string; body: PeriodInput };
type ReservationCommand =
  | { kind: 'create'; body: ReservationInput; key: string }
  | { kind: 'edit'; id: string; body: ReservationPatch }
  | { kind: 'status'; id: string; body: FoodToken & { status: FoodStatus } }
  | { kind: 'assign'; id: string; body: FoodToken & { tableId: string } }
  | { kind: 'unassign'; id: string; body: FoodToken };
async function scope(key: string) {
  const { context } = await currentMe();
  if (
    context?.vertical !== 'FOOD_SERVICE' ||
    !context.businessId ||
    !context.locationId ||
    key !== `${context.businessId}:${context.locationId}`
  )
    throw new ApiError(409, 'Выбран другой ресторан. Откройте форму заново.');
}
function failure(error: unknown) {
  unstable_rethrow(error);
  const message =
    error instanceof Error ? error.message : 'Не удалось сохранить. Повторите действие.';
  const stale =
    error instanceof ApiError && error.status === 409 && /измен|stale|устар/i.test(message);
  return { error: stale ? 'Бронирование уже изменилось. Данные обновлены.' : message, stale };
}
export async function saveFoodCatalog(scopeKey: string, command: CatalogCommand) {
  try {
    await scope(scopeKey);
    if (command.kind === 'area') {
      if (command.id) await foodApi.updateArea(command.id, command.body);
      else await foodApi.createArea(command.body);
    }
    if (command.kind === 'table') {
      const { areaId, ...patch } = command.body;
      if (command.id) await foodApi.updateTable(command.id, patch);
      else await foodApi.createTable({ ...patch, areaId });
    }
    if (command.kind === 'period') {
      if (command.id) await foodApi.updatePeriod(command.id, command.body);
      else await foodApi.createPeriod(command.body);
    }
    for (const path of ['/dining-areas', '/floor-plan', '/table-reservations'])
      revalidatePath(path);
    return { error: null };
  } catch (error) {
    return failure(error);
  }
}
export async function mutateFoodReservation(
  scopeKey: string,
  command: ReservationCommand,
): Promise<{ error: string | null; stale?: boolean; reservation?: RestaurantReservation }> {
  try {
    await scope(scopeKey);
    let reservation: RestaurantReservation;
    switch (command.kind) {
      case 'create':
        reservation = await foodApi.create(command.body, command.key);
        break;
      case 'edit':
        reservation = await foodApi.update(command.id, command.body);
        break;
      case 'status':
        reservation = await foodApi.status(command.id, command.body);
        break;
      case 'assign':
        reservation = await foodApi.assign(command.id, command.body);
        break;
      case 'unassign':
        reservation = await foodApi.unassign(command.id, command.body);
        break;
    }
    for (const path of ['/floor-plan', '/table-reservations']) revalidatePath(path);
    if (command.kind === 'create') revalidatePath('/customers');
    return { error: null, reservation };
  } catch (error) {
    return failure(error);
  }
}
