'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, beautyApi, type BeautyWorkingInterval } from '../../lib/api';
import { pluralRu } from '../../lib/plural';

/**
 * Каталог салона и график мастера: сохранение услуги, её настройки в филиале, мастера, его недели,
 * отсутствий и филиалов (срезы B3 и B4, ADR-141).
 * Отказ API показывается словами, введённое в панели не стирается (DESIGN.md: ошибка у поля, не вместо формы).
 */
export interface SaveResult {
  error?: string;
  message?: string;
}

const failed = (e: unknown, fallback: string): SaveResult => ({
  error: e instanceof ApiError ? e.message : fallback,
});

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value : '';
}

export async function saveBeautyService(
  _prev: SaveResult | null,
  form: FormData,
): Promise<SaveResult> {
  const id = text(form, 'id');
  const body = {
    name: text(form, 'name'),
    category: text(form, 'category'),
    durationMinutes: text(form, 'durationMinutes'),
    priceMinor: text(form, 'priceMinor'),
    currency: text(form, 'currency'),
    active: form.get('active') === 'on',
  };
  try {
    if (id) await beautyApi.updateService(id, body);
    else await beautyApi.createService(body);
    revalidatePath('/beauty/services');
    return { message: id ? 'Услуга сохранена' : 'Услуга добавлена' };
  } catch (e) {
    return failed(e, 'Не удалось сохранить услугу. Обновите страницу перед повтором.');
  }
}

export async function saveLocationService(
  _prev: SaveResult | null,
  form: FormData,
): Promise<SaveResult> {
  const id = text(form, 'id');
  try {
    await beautyApi.setLocationService(id, {
      enabled: form.get('enabled') === 'on',
      priceOverrideMinor: text(form, 'priceOverrideMinor'),
      durationOverrideMinutes: text(form, 'durationOverrideMinutes'),
    });
    revalidatePath('/beauty/services');
    return { message: 'Настройки филиала сохранены' };
  } catch (e) {
    return failed(e, 'Не удалось сохранить настройки филиала.');
  }
}

export async function saveBeautyEmployee(
  _prev: SaveResult | null,
  form: FormData,
): Promise<SaveResult> {
  const id = text(form, 'id');
  const body = {
    name: text(form, 'name'),
    phone: text(form, 'phone'),
    email: text(form, 'email'),
    active: form.get('active') === 'on',
  };
  try {
    const saved = id
      ? await beautyApi.updateEmployee(id, body)
      : await beautyApi.createEmployee(body);
    // умения приходят одним списком: снятые галочки должны сниматься, а не копиться
    const serviceIds = form.getAll('serviceIds').filter((v): v is string => typeof v === 'string');
    await beautyApi.setEmployeeServices(saved.id, serviceIds);
    revalidatePath('/beauty/masters');
    return { message: id ? 'Мастер сохранён' : 'Мастер добавлен' };
  } catch (e) {
    return failed(e, 'Не удалось сохранить мастера. Обновите страницу перед повтором.');
  }
}

export async function saveBeautyWorkingHours(
  _prev: SaveResult | null,
  form: FormData,
): Promise<SaveResult> {
  const id = text(form, 'id');
  let intervals: BeautyWorkingInterval[];
  try {
    intervals = JSON.parse(text(form, 'intervals') || '[]') as BeautyWorkingInterval[];
  } catch {
    return { error: 'Не удалось прочитать график. Обновите страницу перед повтором.' };
  }
  try {
    await beautyApi.setWorkingHours(id, intervals);
    revalidatePath('/beauty/schedule');
    return { message: 'График сохранён' };
  } catch (e) {
    return failed(e, 'Не удалось сохранить график. Обновите страницу перед повтором.');
  }
}

export async function addBeautyTimeOff(
  _prev: SaveResult | null,
  form: FormData,
): Promise<SaveResult> {
  const id = text(form, 'id');
  try {
    const { affected } = await beautyApi.addTimeOff(id, {
      dateFrom: text(form, 'dateFrom'),
      dateTo: text(form, 'dateTo'),
      reason: text(form, 'reason'),
    });
    revalidatePath('/beauty/schedule');
    // записи отсутствие не отменяет: это деньги, решение владельца по Q-252 ещё не принято
    return {
      message: affected
        ? `Отсутствие добавлено. В эти дни у мастера остаётся ${pluralRu(affected, ['запись', 'записи', 'записей'])}: их никто не отменил.`
        : 'Отсутствие добавлено',
    };
  } catch (e) {
    return failed(e, 'Не удалось добавить отсутствие. Обновите страницу перед повтором.');
  }
}

export async function removeBeautyTimeOff(
  employeeId: string,
  timeOffId: string,
): Promise<SaveResult> {
  try {
    await beautyApi.removeTimeOff(employeeId, timeOffId);
    revalidatePath('/beauty/schedule');
    return { message: 'Отсутствие снято' };
  } catch (e) {
    return failed(e, 'Не удалось снять отсутствие. Обновите страницу перед повтором.');
  }
}

export async function saveBeautyEmployeeLocations(
  _prev: SaveResult | null,
  form: FormData,
): Promise<SaveResult> {
  const id = text(form, 'id');
  // филиалы приходят одним списком: снятая галочка должна сниматься, а не копиться
  const locationIds = form.getAll('locationIds').filter((v): v is string => typeof v === 'string');
  try {
    await beautyApi.setEmployeeLocations(id, locationIds);
    revalidatePath('/beauty/schedule');
    return { message: 'Филиалы мастера сохранены' };
  } catch (e) {
    return failed(e, 'Не удалось сохранить филиалы мастера.');
  }
}
