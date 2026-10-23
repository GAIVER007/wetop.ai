'use server';
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { ApiError } from '../../lib/api-error';
import { currentMe } from '../../lib/desk-shell';
import { hotelStaffApi } from '../../lib/hotel-staff-api';
import type { PayModel } from '../../lib/food-types';

/**
 * Действия кабинета горничной и персонала гостиницы (решение 22.10.2026). Права решает API: «Убрано» и «Сделано»
 * только своим, назначение и график стойке и руководителю. Здесь только выбранная гостиница и текст отказа словами.
 */
export interface HotelActionResult {
  error: string | null;
}

async function hotel(scopeKey?: string) {
  const { context } = await currentMe();
  if (context?.vertical !== 'HOSPITALITY' || !context.businessId || !context.locationId)
    throw new ApiError(409, 'Выбрана другая гостиница. Обновите страницу.');
  if (scopeKey !== undefined && scopeKey !== `${context.businessId}:${context.locationId}`)
    throw new ApiError(409, 'Выбрана другая гостиница. Откройте форму заново.');
}
function failure(error: unknown): HotelActionResult {
  unstable_rethrow(error);
  return { error: error instanceof Error ? error.message : 'Не удалось сохранить. Повторите действие.' };
}
async function run(fn: () => Promise<unknown>, paths: string[], scopeKey?: string): Promise<HotelActionResult> {
  try {
    await hotel(scopeKey);
    await fn();
    for (const path of paths) revalidatePath(path);
    return { error: null };
  } catch (error) {
    return failure(error);
  }
}

export async function cleanUnitAction(code: string): Promise<HotelActionResult> {
  return run(() => hotelStaffApi.clean(code), ['/my-work', '/inventory', '/chessboard']);
}

export async function taskDoneAction(taskId: string): Promise<HotelActionResult> {
  return run(() => hotelStaffApi.taskDone(taskId), ['/my-work', '/tasks']);
}

export async function assignHousekeeperAction(code: string, employeeId: string | null): Promise<HotelActionResult> {
  return run(() => hotelStaffApi.assignHousekeeper(code, employeeId), [`/units/${code}`, '/inventory', '/my-work']);
}

export async function hotelPaySettingsAction(
  scopeKey: string,
  employeeId: string,
  body: { model: PayModel; fixedMinor: number; percent: number; perCleaningMinor: number },
): Promise<HotelActionResult> {
  return run(() => hotelStaffApi.setPaySettings(employeeId, body), ['/payroll', '/my-work'], scopeKey);
}

export async function hotelAdjustmentAction(
  scopeKey: string,
  employeeId: string,
  body: { period: string; amountMinor: number; reason: string },
): Promise<HotelActionResult> {
  return run(() => hotelStaffApi.addPayAdjustment(employeeId, body), ['/payroll', '/my-work'], scopeKey);
}

/** Сотрудник гостиницы из приглашения «Сотрудники» (уровни «Без входа» и «Личный кабинет») */
export async function createHotelEmployeeAction(body: {
  name: string;
  phone?: string | null;
  email?: string | null;
}): Promise<{ error: string | null; id?: string }> {
  try {
    await hotel();
    const row = await hotelStaffApi.createEmployee({ ...body, personnelKind: 'OTHER_EMPLOYEE' });
    for (const path of ['/team', '/staff-schedule', '/payroll']) revalidatePath(path);
    return { error: null, id: row.id };
  } catch (error) {
    return failure(error);
  }
}

export async function saveHotelShifts(
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
    await hotel(scopeKey);
    const saved = await hotelStaffApi.setShifts(String(form.get('id') ?? ''), intervals, String(form.get('expectedRevision') ?? ''));
    for (const path of ['/staff-schedule', '/my-work']) revalidatePath(path);
    return { message: 'График сохранён', revision: saved.weekRevision };
  } catch (error) {
    return { error: failure(error).error ?? 'Не удалось сохранить график' };
  }
}

export async function loadHotelShift(scopeKey: string, employeeId: string) {
  try {
    await hotel(scopeKey);
    const row = (await hotelStaffApi.shifts()).employees.find((e) => e.id === employeeId);
    return row ? { data: { week: row.week, weekRevision: row.weekRevision, location: { id: scopeKey } } } : { error: 'Сотрудник не найден' };
  } catch (error) {
    return failure(error);
  }
}
