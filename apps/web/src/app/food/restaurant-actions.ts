'use server';
import { revalidatePath } from 'next/cache';
import type { TableLayout } from '@pms/domain';
import { unstable_rethrow } from 'next/navigation';
import { ApiError, dishPhotoApi } from '../../lib/api';
import { currentMe } from '../../lib/desk-shell';
import { foodApi, restaurantApi } from '../../lib/food-api';
import type {
  FoodCashOperationInput,
  FoodPaymentMethod,
  IngredientInput,
  MenuCategoryInput,
  MenuItemInput,
  MenuItemView,
  ModifierGroupInput,
  OrderCreateInput,
  OrderItemStatus,
  OrderPatch,
  OrderStatus,
  OrderToken,
  OrderView,
  PayModel,
} from '../../lib/food-types';

type MenuCommand =
  | { kind: 'category'; id?: string; body: Partial<MenuCategoryInput> }
  | { kind: 'item'; id?: string; body: Partial<MenuItemInput> }
  | { kind: 'ingredients'; id: string; ingredients: IngredientInput[] }
  // §33.7: группы добавок бизнеса и группы блюда
  | { kind: 'modifier-group'; id?: string; body: Partial<ModifierGroupInput> }
  | { kind: 'item-modifier-groups'; id: string; groupIds: string[] };
type OrderCommand =
  | { kind: 'create'; body: OrderCreateInput }
  | { kind: 'edit'; id: string; body: OrderPatch }
  | { kind: 'status'; id: string; body: OrderToken & { status: OrderStatus } }
  // §33.6: позиция на своей станции (кухня, бар) или «Подано» у официанта
  | { kind: 'item-status'; id: string; itemId: string; body: { status: OrderItemStatus; expectedUpdatedAt: string } }
  | {
      kind: 'pay';
      id: string;
      body: { method: FoodPaymentMethod; amount: number; idempotencyKey: string; itemIds?: string[] };
    }
  | { kind: 'void-payment'; id: string; reason: string }
  | {
      kind: 'refund';
      id: string;
      body: { method: FoodPaymentMethod; amount: number; reason: string; idempotencyKey: string };
    }
  | { kind: 'rate'; id: string; body: { stars: number; comment: string | null } };
type CashCommand =
  | { kind: 'operation'; body: FoodCashOperationInput }
  | { kind: 'void'; id: string }
  | { kind: 'reconcile'; body: { method: FoodPaymentMethod; counted: number; note?: string | null } };
type StaffCommand =
  | {
      kind: 'create';
      body: {
        name: string;
        phone?: string | null;
        email?: string | null;
        personnelKind?: 'SPECIALIST' | 'OTHER_EMPLOYEE' | 'BOTH';
      };
    }
  | {
      kind: 'edit';
      id: string;
      body: { name?: string; phone?: string | null; email?: string | null; status?: string; expectedProfileRevision: string };
    }
  | { kind: 'pay-settings'; id: string; body: { model: PayModel; fixedMinor: number; percent: number } }
  | { kind: 'adjustment'; id: string; body: { period: string; amountMinor: number; reason: string } }
  | { kind: 'payout'; id: string; body: { period: string; method: FoodPaymentMethod; amount: number; idempotencyKey: string } };

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
    } else if (command.kind === 'modifier-group') {
      if (command.id) await restaurantApi.updateModifierGroup(command.id, command.body);
      else await restaurantApi.createModifierGroup(command.body as ModifierGroupInput);
    } else if (command.kind === 'item-modifier-groups') {
      await restaurantApi.setItemModifierGroups(command.id, command.groupIds);
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
      case 'item-status':
        order = await restaurantApi.itemStatus(command.id, command.itemId, command.body);
        break;
      case 'pay':
        order = await restaurantApi.payOrder(command.id, command.body);
        break;
      case 'void-payment':
        order = await restaurantApi.voidPayment(command.id, command.reason);
        break;
      case 'refund':
        order = await restaurantApi.refundOrder(command.id, command.body);
        break;
      case 'rate':
        order = await restaurantApi.rateOrder(command.id, command.body);
        break;
    }
    for (const path of ['/orders', '/kitchen', '/drinks', '/waiter', '/floor-plan', '/today', '/cashbox', '/employees'])
      revalidatePath(path);
    return { error: null, order };
  } catch (error) {
    return failure(error);
  }
}

/** Ссылка на оценку с телефона гостя по QR-коду (§40) */
export async function orderRatingLink(
  scopeKey: string,
  id: string,
): Promise<{ error: string | null; token?: string; expiresAt?: string }> {
  try {
    await scope(scopeKey);
    return { error: null, ...(await restaurantApi.ratingLink(id)) };
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
): Promise<{ error: string | null; createdId?: string }> {
  try {
    await scope(scopeKey);
    let createdId: string | undefined;
    if (command.kind === 'create') createdId = (await restaurantApi.createEmployee(command.body)).id;
    else if (command.kind === 'edit') await restaurantApi.updateEmployee(command.id, command.body);
    else if (command.kind === 'pay-settings')
      await restaurantApi.setPaySettings(command.id, command.body);
    else if (command.kind === 'payout') await restaurantApi.payout(command.id, command.body);
    else await restaurantApi.addPayAdjustment(command.id, command.body);
    for (const path of ['/employees', '/payroll', '/cashbox']) revalidatePath(path);
    return { error: null, ...(createdId ? { createdId } : {}) };
  } catch (error) {
    return failure(error);
  }
}

/** Назначение «специалист / другой сотрудник / оба» со строки «Сотрудников» ресторана (решение 20.10.2026) */
export async function assignFoodPersonnelKind(
  scopeKey: string,
  id: string,
  personnelKind: string,
  expectedProfileRevision: string,
): Promise<{ error: string | null }> {
  if (personnelKind !== 'SPECIALIST' && personnelKind !== 'OTHER_EMPLOYEE' && personnelKind !== 'BOTH')
    return { error: 'Выберите назначение: специалист, другой сотрудник или оба.' };
  try {
    await scope(scopeKey);
    await restaurantApi.assignEmployeePersonnelKind(id, { personnelKind, expectedProfileRevision });
    revalidatePath('/employees');
    return { error: null };
  } catch (error) {
    if (error instanceof ApiError && error.status === 409)
      return { error: 'Сотрудника изменили в другом окне. Список обновлён, выберите назначение ещё раз.' };
    return failure(error);
  }
}

/** Касса филиала (§35.2): операция, аннулирование, сверка */
export async function mutateCash(
  scopeKey: string,
  command: CashCommand,
): Promise<{ error: string | null }> {
  // Compatibility adapter for existing imports; cash does not grant other restaurant actions.
  const { mutateCash: branchCash } = await import('../cashbox/actions');
  return branchCash(scopeKey, command);
}

/** VIP-метка и дата рождения клиента (§36, ADR-166) */
export async function markCustomer(
  scopeKey: string,
  id: string,
  body: { isVip: boolean; birthDate: string | null },
): Promise<{ error: string | null }> {
  try {
    await scope(scopeKey);
    await foodApi.updateCustomer(id, body);
    revalidatePath('/customers');
    return { error: null };
  } catch (error) {
    return failure(error);
  }
}

/** Фото блюда (§37): файл приходит формой, на API уходит тем же multipart */
export async function dishPhoto(
  scopeKey: string,
  id: string,
  form: FormData | null,
): Promise<{ error: string | null }> {
  try {
    await scope(scopeKey);
    if (form === null) await dishPhotoApi.remove(id);
    else {
      const file = form.get('file');
      if (!(file instanceof File) || file.size === 0) return { error: 'Выберите файл: JPEG, PNG или WebP' };
      await dishPhotoApi.upload(id, file);
    }
    revalidatePath('/menu');
    return { error: null };
  } catch (error) {
    return failure(error);
  }
}

/** График смен сотрудника (Q-REST-11): форма недели салона, `scopeKey` привязан заранее */
export async function saveFoodShifts(
  scopeKey: string,
  _prev: { error?: string; message?: string; revision?: string } | null,
  form: FormData,
): Promise<{ error?: string; message?: string; revision?: string }> {
  let intervals: Array<{ weekday: number; timeFrom: string; timeTo: string }>;
  try {
    intervals = JSON.parse(String(form.get('intervals') ?? '[]'));
  } catch {
    return { error: 'Не удалось прочитать график. Обновите страницу перед повтором.' };
  }
  try {
    await scope(scopeKey);
    const saved = await restaurantApi.setShifts(String(form.get('id') ?? ''), intervals, String(form.get('expectedRevision') ?? ''));
    for (const path of ['/employees', '/employees/shifts', '/today']) revalidatePath(path);
    return { message: 'График сохранён', revision: saved.weekRevision };
  } catch (error) {
    const { error: message } = failure(error);
    return { error: message ?? 'Не удалось сохранить график' };
  }
}

/** Схема зала (§42): расстановка зоны одним запросом */
export async function saveFloorLayout(
  scopeKey: string,
  areaId: string,
  tables: TableLayout[],
): Promise<{ error: string | null }> {
  try {
    await scope(scopeKey);
    await foodApi.setLayout(areaId, tables);
    for (const path of ['/floor-plan', '/dining-areas', '/today']) revalidatePath(path);
    return { error: null };
  } catch (error) {
    return { error: failure(error).error };
  }
}


/** Explicit reread, never a silent rebase of the editor's original token. */
export async function loadFoodShift(scopeKey: string, employeeId: string) {
  try {
    await scope(scopeKey);
    const row = (await restaurantApi.shifts()).employees.find(e => e.id === employeeId);
    return row ? { data: { week: row.week, weekRevision: row.weekRevision, location: { id: scopeKey } } } : { error: 'Сотрудник не найден' };
  } catch (error) {
    return failure(error);
  }
}
