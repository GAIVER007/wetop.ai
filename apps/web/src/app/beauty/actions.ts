'use server';
import { revalidatePath } from 'next/cache';
import {
  ApiError,
  authApi,
  beautyApi,
  type BeautyEmployeeRow,
  type BeautyWorkingInterval,
} from '../../lib/api';
import { pluralRu } from '../../lib/plural';

/**
 * Каталог салона и график мастера: сохранение услуги, её настройки в филиале, мастера, его недели,
 * отсутствий и филиалов (срезы B3 и B4, ADR-141).
 * Отказ API показывается словами, введённое в панели не стирается (DESIGN.md: ошибка у поля, не вместо формы).
 */
export interface SaveResult {
  error?: string;
  message?: string;
  resourceId?: string;
  revision?: string;
  employee?: BeautyEmployeeRow;
  currentEmployee?: BeautyEmployeeRow;
}

const failed = (e: unknown, fallback: string): SaveResult => ({
  error: e instanceof ApiError ? e.message : fallback,
});

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value : '';
}

async function scopeError(form: FormData): Promise<SaveResult | null> {
  const expected = text(form, 'scopeKey');
  if (!expected) return null;
  try {
    const { context } = await authApi.me();
    return context?.locationId === expected
      ? null
      : {
          error:
            'Филиал изменён. Вернитесь к настройке текущего филиала; прежний ввод не сохранён поверх его данных.',
        };
  } catch {
    return { error: 'Не удалось проверить филиал. Попробуйте ещё раз; данные формы сохранены.' };
  }
}
function changedBody(form: FormData, body: Record<string, unknown>) {
  const raw = text(form, 'changedFields');
  if (!raw) return body;
  const keys: unknown = JSON.parse(raw);
  if (!Array.isArray(keys) || keys.some((key) => typeof key !== 'string' || !(key in body)))
    throw new Error('Некорректные поля изменения');
  return Object.fromEntries(keys.map((key) => [key, body[key]]));
}

export async function saveBeautyService(
  _prev: SaveResult | null,
  form: FormData,
): Promise<SaveResult> {
  const id = text(form, 'id');
  const mismatch = await scopeError(form);
  if (mismatch) return mismatch;
  const body = {
    name: text(form, 'name'),
    category: text(form, 'category'),
    durationMinutes: text(form, 'durationMinutes'),
    priceMinor: text(form, 'priceMinor'),
    currency: text(form, 'currency'),
    active: form.get('active') === 'on',
  };
  try {
    const saved = id
      ? await beautyApi.updateService(id, changedBody(form, body))
      : await beautyApi.createService({
          ...body,
          creationId: text(form, 'creationId') || undefined,
        });
    revalidatePath('/calendar');
    revalidatePath('/appointments');
    revalidatePath('/employees');
    revalidatePath('/services');
    revalidatePath('/customers');
    revalidatePath('/beauty/services');
    return {
      message: id ? 'Услуга сохранена' : 'Услуга создана. Включите её в выбранном филиале ниже.',
      resourceId: saved.id,
    };
  } catch (e) {
    return failed(e, 'Не удалось сохранить услугу. Обновите страницу перед повтором.');
  }
}

export async function saveLocationService(
  _prev: SaveResult | null,
  form: FormData,
): Promise<SaveResult> {
  const id = text(form, 'id');
  const mismatch = await scopeError(form);
  if (mismatch) return mismatch;
  try {
    await beautyApi.setLocationService(id, {
      enabled: form.get('enabled') === 'on',
      priceOverrideMinor: text(form, 'priceOverrideMinor'),
      durationOverrideMinutes: text(form, 'durationOverrideMinutes'),
    });
    revalidatePath('/calendar');
    revalidatePath('/appointments');
    revalidatePath('/employees');
    revalidatePath('/services');
    revalidatePath('/customers');
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
  const mismatch = await scopeError(form);
  if (mismatch) return mismatch;
  const section = text(form, 'section') || 'all';
  let resourceId = id || _prev?.resourceId;
  let revision = text(form, 'expectedRevision') || _prev?.revision;
  let employee: BeautyEmployeeRow | undefined;
  try {
    if (section !== 'skills' && !(_prev?.resourceId && !id)) {
      const body = {
        name: text(form, 'name'),
        phone: text(form, 'phone'),
        email: text(form, 'email'),
        active:
          form.has('activePresent') || id
            ? form.get('active') === 'on'
            : !form.has('active') || form.get('active') === 'on',
      };
      const saved = id
        ? await beautyApi.updateEmployee(id, {
            ...changedBody(form, body),
            ...(text(form, 'expectedProfileRevision')
              ? { expectedProfileRevision: text(form, 'expectedProfileRevision') }
              : {}),
          })
        : await beautyApi.createEmployee({
            ...body,
            creationId: text(form, 'creationId') || undefined,
          });
      employee = saved;
      resourceId = saved.id;
      if (!id) revision = saved.servicesRevision;
    }
    if (!resourceId) return { error: 'Сотрудник не создан. Проверьте данные.' };
    const assignServices =
      section === 'skills' || (section === 'all' && (Boolean(id) || form.has('serviceIds')));
    if (assignServices) {
      const serviceIds = form
        .getAll('serviceIds')
        .filter((v): v is string => typeof v === 'string');
      const saved = await beautyApi.setEmployeeServices(resourceId, serviceIds, revision);
      revision = saved.servicesRevision;
      employee = saved;
    }
    for (const path of [
      '/calendar',
      '/appointments',
      '/employees',
      '/services',
      '/customers',
      '/beauty/masters',
      '/register/setup',
    ])
      revalidatePath(path);
    return {
      message:
        section === 'skills'
          ? 'Услуги назначены'
          : section === 'basic' && id
            ? 'Сотрудник сохранён'
            : assignServices
              ? 'Сотрудник создан, услуги назначены'
              : 'Сотрудник создан',
      resourceId,
      ...(employee ? { employee } : {}),
      ...(revision ? { revision } : {}),
    };
  } catch (e) {
    const current =
      e instanceof ApiError && e.status === 409 && id && section === 'basic'
        ? await loadBeautyEmployee(id)
        : null;
    const sameScope =
      current && (!text(form, 'scopeKey') || current.locationId === text(form, 'scopeKey'));
    return {
      ...(sameScope && current.employee ? { currentEmployee: current.employee } : {}),
      ...failed(e, 'Не удалось сохранить. Введённые данные оставлены в форме.'),
      ...(resourceId ? { resourceId } : {}),
      ...(revision ? { revision } : {}),
    };
  }
}

export async function saveBeautyWorkingHours(
  _prev: SaveResult | null,
  form: FormData,
): Promise<SaveResult> {
  const id = text(form, 'id');
  const mismatch = await scopeError(form);
  if (mismatch) return mismatch;
  let intervals: BeautyWorkingInterval[];
  try {
    intervals = JSON.parse(text(form, 'intervals') || '[]') as BeautyWorkingInterval[];
  } catch {
    return { error: 'Не удалось прочитать график. Обновите страницу перед повтором.' };
  }
  try {
    const saved = await beautyApi.setWorkingHours(
      id,
      intervals,
      text(form, 'expectedRevision') || undefined,
    );
    revalidatePath('/calendar');
    revalidatePath('/appointments');
    revalidatePath('/employees');
    revalidatePath('/services');
    revalidatePath('/customers');
    revalidatePath('/beauty/schedule');
    return {
      message: 'График сохранён',
      ...(saved.weekRevision ? { revision: saved.weekRevision } : {}),
    };
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
    revalidatePath('/calendar');
    revalidatePath('/appointments');
    revalidatePath('/employees');
    revalidatePath('/services');
    revalidatePath('/customers');
    revalidatePath('/beauty/schedule');
    // записи отсутствие не отменяет: это деньги, решение владельца по Q-252 ещё не принято
    return {
      message: affected
        ? `Отсутствие добавлено. В эти дни у специалиста остаётся ${pluralRu(affected, ['запись', 'записи', 'записей'])}: их никто не отменил.`
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
    revalidatePath('/calendar');
    revalidatePath('/appointments');
    revalidatePath('/employees');
    revalidatePath('/services');
    revalidatePath('/customers');
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
    revalidatePath('/calendar');
    revalidatePath('/appointments');
    revalidatePath('/employees');
    revalidatePath('/services');
    revalidatePath('/customers');
    revalidatePath('/beauty/schedule');
    return { message: 'Филиалы специалиста сохранены' };
  } catch (e) {
    return failed(e, 'Не удалось сохранить филиалы специалиста.');
  }
}

export async function loadBeautySchedule(employeeId: string) {
  try {
    return { data: await beautyApi.schedule(employeeId) };
  } catch (error) {
    return { error: failed(error, 'Не удалось загрузить график').error ?? 'Не удалось загрузить график' };
  }
}

export async function loadBeautyEmployee(id: string) {
  try {
    const data = await beautyApi.employees();
    const employee = data.items.find((row) => row.id === id);
    return employee
      ? { employee, locationId: data.locationId, error: null }
      : { employee: null, locationId: data.locationId, error: 'Специалист недоступен' };
  } catch (error) {
    return {
      employee: null,
      locationId: null,
      error: error instanceof ApiError ? error.message : 'Не удалось прочитать актуальные услуги',
    };
  }
}
