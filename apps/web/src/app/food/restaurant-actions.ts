'use server';
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { ApiError } from '../../lib/api';
import { currentMe } from '../../lib/desk-shell';
import { restaurantApi } from '../../lib/food-api';
import type {
  IngredientInput,
  MenuCategoryInput,
  MenuItemInput,
  MenuItemView,
  OrderCreateInput,
  OrderPatch,
  OrderStatus,
  OrderToken,
  OrderView,
  PayModel,
} from '../../lib/food-types';

type MenuCommand =
  | { kind: 'category'; id?: string; body: Partial<MenuCategoryInput> }
  | { kind: 'item'; id?: string; body: Partial<MenuItemInput> }
  | { kind: 'ingredients'; id: string; ingredients: IngredientInput[] };
type OrderCommand =
  | { kind: 'create'; body: OrderCreateInput }
  | { kind: 'edit'; id: string; body: OrderPatch }
  | { kind: 'status'; id: string; body: OrderToken & { status: OrderStatus } };
type StaffCommand =
  | { kind: 'create'; body: { name: string; phone?: string | null; email?: string | null } }
  | {
      kind: 'edit';
      id: string;
      body: { name?: string; phone?: string | null; email?: string | null; status?: string };
    }
  | { kind: 'pay-settings'; id: string; body: { model: PayModel; fixedMinor: number; percent: number } }
  | { kind: 'adjustment'; id: string; body: { period: string; amountMinor: number; reason: string } };

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
  return { error: stale ? 'Заказ уже изменился. Данные обновлены.' : message, stale };
}

export async function mutateMenu(
  scopeKey: string,
  command: MenuCommand,
): Promise<{ error: string | null; item?: MenuItemView }> {
  try {
    await scope(scopeKey);
    let item: MenuItemView | undefined;
    if (command.kind === 'category') {
      if (command.id) await restaurantApi.updateCategory(command.id, command.body);
      else await restaurantApi.createCategory(command.body as MenuCategoryInput);
    } else if (command.kind === 'item') {
      item = command.id
        ? await restaurantApi.updateMenuItem(command.id, command.body)
        : await restaurantApi.createMenuItem(command.body as MenuItemInput);
    } else item = await restaurantApi.replaceIngredients(command.id, command.ingredients);
    revalidatePath('/menu');
    return { error: null, ...(item ? { item } : {}) };
  } catch (error) {
    return failure(error);
  }
}

export async function mutateOrder(
  scopeKey: string,
  command: OrderCommand,
): Promise<{ error: string | null; stale?: boolean; order?: OrderView }> {
  try {
    await scope(scopeKey);
    let order: OrderView;
    switch (command.kind) {
      case 'create':
        order = await restaurantApi.createOrder(command.body);
        break;
      case 'edit':
        order = await restaurantApi.updateOrder(command.id, command.body);
        break;
      case 'status':
        order = await restaurantApi.orderStatus(command.id, command.body);
        break;
    }
    for (const path of ['/orders', '/kitchen', '/floor-plan', '/today']) revalidatePath(path);
    return { error: null, order };
  } catch (error) {
    return failure(error);
  }
}

export async function setTableCleaning(
  scopeKey: string,
  tableId: string,
  needsCleaning: boolean,
): Promise<{ error: string | null }> {
  try {
    await scope(scopeKey);
    await restaurantApi.tableCleaning(tableId, needsCleaning);
    revalidatePath('/floor-plan');
    return { error: null };
  } catch (error) {
    return failure(error);
  }
}

export async function mutateStaff(
  scopeKey: string,
  command: StaffCommand,
): Promise<{ error: string | null }> {
  try {
    await scope(scopeKey);
    if (command.kind === 'create') await restaurantApi.createEmployee(command.body);
    else if (command.kind === 'edit') await restaurantApi.updateEmployee(command.id, command.body);
    else if (command.kind === 'pay-settings')
      await restaurantApi.setPaySettings(command.id, command.body);
    else await restaurantApi.addPayAdjustment(command.id, command.body);
    for (const path of ['/employees', '/payroll']) revalidatePath(path);
    return { error: null };
  } catch (error) {
    return failure(error);
  }
}
