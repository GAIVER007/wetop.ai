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
import { PRESETS } from './services/presets';

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

const BULK_LIMIT = 50;

/**
 * Массовый перенос услуг между «Каталогом» и «Услугами филиала»: галочки в списке, одна кнопка.
 * Цены тут не вводятся и не меняются: у существующей услуги остаются её цена каталога и своя цена филиала,
 * у типовой создаётся карточка с ценой 0, человек задаёт цену вручную («Изменить»). Состояние читается
 * заново с сервера, а не берётся из формы: устаревшая страница не перезапишет чужую правку.
 */
export async function moveLocationServices(
  _prev: SaveResult | null,
  form: FormData,
): Promise<SaveResult> {
  const mismatch = await scopeError(form);
  if (mismatch) return mismatch;
  const enable = form.get('direction') === 'enable';
  const ids = [...new Set(form.getAll('id').filter((v): v is string => typeof v === 'string' && v !== ''))];
  const presetNames = enable
    ? [...new Set(form.getAll('preset').filter((v): v is string => typeof v === 'string'))]
    : [];
  if (ids.length + presetNames.length === 0) return { error: 'Отметьте услуги галочкой.' };
  if (ids.length + presetNames.length > BULK_LIMIT)
    return { error: `За один раз можно перенести не больше ${BULK_LIMIT} услуг.` };
  let current: Awaited<ReturnType<typeof beautyApi.services>>;
  try {
    current = await beautyApi.services();
  } catch (e) {
    return failed(e, 'Не удалось загрузить услуги. Обновите страницу и повторите.');
  }
  if (!current.locationId || !current.locationCurrency)
    return { error: 'Выберите филиал, чтобы добавлять и убирать его услуги.' };
  const byId = new Map(current.items.map((item) => [item.id, item]));
  const byName = new Map(current.items.map((item) => [item.name.trim().toLocaleLowerCase('ru-RU'), item]));
  let done = 0;
  const failedNames: string[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (!row) continue;
    if (Boolean(row.location?.enabled) === enable) continue;
    if (enable && !row.active) continue;
    try {
      await beautyApi.setLocationService(id, {
        enabled: enable,
        priceOverrideMinor: row.location?.priceOverrideMinor ?? '',
        durationOverrideMinutes:
          row.location?.durationOverrideMinutes == null ? '' : String(row.location.durationOverrideMinutes),
      });
      done += 1;
    } catch {
      failedNames.push(row.name);
    }
  }
  for (const name of presetNames) {
    const preset = PRESETS.find((item) => item.name === name);
    if (!preset) continue;
    try {
      const existing = byName.get(preset.name.toLocaleLowerCase('ru-RU'));
      if (existing?.location?.enabled) continue;
      const serviceId =
        existing && existing.active
          ? existing.id
          : (
              await beautyApi.createService({
                name: preset.name,
                category: preset.category,
                durationMinutes: String(preset.minutes),
                priceMinor: '0',
                currency: current.locationCurrency,
                active: true,
                creationId: crypto.randomUUID(),
              })
            ).id;
      await beautyApi.setLocationService(serviceId, {
        enabled: true,
        priceOverrideMinor: '',
        durationOverrideMinutes: '',
      });
      done += 1;
    } catch {
      failedNames.push(preset.name);
    }
  }
  revalidatePath('/calendar');
  revalidatePath('/appointments');
  revalidatePath('/employees');
  revalidatePath('/services');
  revalidatePath('/customers');
  revalidatePath('/beauty/services');
  const verb = enable ? 'Добавлено в филиал' : 'Убрано из филиала';
  if (failedNames.length > 0)
    return { error: `${verb}: ${done}. Не удалось перенести: ${failedNames.join(', ')}. Повторите для них.` };
  if (done === 0) return { message: 'Выбранные услуги уже там, куда вы их переносите.' };
  return { message: `${verb}: ${pluralRu(done, ['услуга', 'услуги', 'услуг'])}` };
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
            // назначение нового сотрудника выбирает руководитель в форме; старые клиенты поле не шлют
            ...(isPersonnelKind(text(form, 'personnelKind'))
              ? { personnelKind: text(form, 'personnelKind') }
              : {}),
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

const isPersonnelKind = (value: string): value is NonNullable<BeautyEmployeeRow['personnelKind']> =>
  value === 'SPECIALIST' || value === 'OTHER_EMPLOYEE' || value === 'BOTH';

export interface PersonnelKindResult {
  employee?: BeautyEmployeeRow;
  error?: string;
  /** 409: сотрудника изменили в другом окне, экран перезагружает список */
  conflict?: boolean;
}

/** Назначение «специалист / другой сотрудник / оба» со строки экрана «Специалисты» */
export async function assignBeautyPersonnelKind(
  id: string,
  personnelKind: string,
  expectedProfileRevision: string,
): Promise<PersonnelKindResult> {
  if (!isPersonnelKind(personnelKind))
    return { error: 'Выберите назначение: специалист, другой сотрудник или оба.' };
  try {
    const employee = await beautyApi.assignEmployeePersonnelKind(id, {
      personnelKind,
      expectedProfileRevision,
    });
    for (const path of ['/employees', '/beauty/masters']) revalidatePath(path);
    return { employee };
  } catch (e) {
    if (e instanceof ApiError && e.status === 409)
      return {
        conflict: true,
        error: 'Сотрудника изменили в другом окне. Список обновлён, выберите назначение ещё раз.',
      };
    return failed(e, 'Не удалось сохранить назначение. Попробуйте ещё раз.');
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
