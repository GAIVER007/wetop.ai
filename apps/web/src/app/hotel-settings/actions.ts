'use server';
import { revalidatePath } from 'next/cache';
import {
  ApiError,
  hotelSettingsApi,
  propertyMediaApi,
  serviceCatalogApi,
  type CatalogService,
} from '../../lib/api';
import { parseServiceInput, type ServiceInputField } from '@pms/domain';
import { formValues } from '../../lib/form-values';

export interface SettingsActionResult {
  error: string | null;
  message: string | null;
  values?: Record<string, string>;
  attempt?: number;
}

/** Поля «Настроек объекта» — ровно те, что API принимает (DATA_MODEL §1 и §31; валюта и пояс — только просмотр) */
const TEXT_FIELDS = [
  'name',
  'legalName',
  'bin',
  'address',
  'phone',
  'email',
  'countryCode',
  'city',
  'channexPropertyType',
  'checkInTime',
  'checkOutTime',
  'description',
  'website',
  'publicName',
  'houseRulesNote',
  'quietHoursFrom',
  'quietHoursTo',
] as const;
/** Выключатели: в форме пара значений (скрытое и флажок), считается последнее */
const FLAG_FIELDS = [
  'earlyCheckIn',
  'lateCheckOut',
  'childrenAllowed',
  'petsAllowed',
  'smokingAllowed',
] as const;
const CHOICE_FIELDS = ['onsitePayment', 'cancellationRule', 'depositRule'] as const;
const FIELDS = [...TEXT_FIELDS, ...FLAG_FIELDS, ...CHOICE_FIELDS, 'minGuestAge', 'amenities'] as const;
type Field = (typeof FIELDS)[number];

/** Что пользователь ввёл, как строки: для возврата в форму при отказе API */
function kept(form: FormData, names: readonly Field[]): Record<string, string> {
  return Object.fromEntries(
    names.map((name) => {
      const all = form.getAll(name).map(String);
      return [name, name === 'amenities' ? all.filter(Boolean).join(',') : (all.at(-1) ?? '')];
    }),
  );
}

/**
 * Сохранить сведения объекта (ТЗ ux-retention п. 3.1): пустое необязательное поле — «нет значения». Уходят только
 * поля, которые есть в форме: у «Основного» и «Проживания» свои формы (ADR-115), и одна не должна стирать другую.
 * Карточка (ADR-156): выключатели приходят булевыми, удобства списком кодов, возраст числом.
 */
export async function saveHotelSettings(
  prev: SettingsActionResult | null,
  form: FormData,
): Promise<SettingsActionResult> {
  const present = FIELDS.filter((name) => form.has(name));
  const last = (name: Field) => String(form.getAll(name).at(-1) ?? '').trim();
  const patch = Object.fromEntries(
    present.map((name): [string, unknown] => {
      if ((FLAG_FIELDS as readonly string[]).includes(name)) return [name, last(name) === 'true'];
      if (name === 'amenities') return [name, form.getAll(name).map(String).filter(Boolean)];
      const v = last(name);
      if ((CHOICE_FIELDS as readonly string[]).includes(name) || name === 'minGuestAge')
        return [name, v];
      return [name, v === '' && name !== 'name' ? null : v];
    }),
  );
  try {
    await hotelSettingsApi.update(patch);
    // название и реквизиты видны в меню, печатных формах и у ИИ-продавца
    revalidatePath('/', 'layout');
    return { error: null, message: 'Изменения сохранены' };
  } catch (e) {
    return {
      error: e instanceof ApiError || e instanceof Error ? e.message : String(e),
      message: null,
      values: kept(form, present),
      attempt: (prev?.attempt ?? 0) + 1,
    };
  }
}

export interface ServiceActionResult {
  error: string | null;
  /** Поле, к которому относится ошибка: стойка подсвечивает его и пишет причину под ним */
  field?: ServiceInputField | undefined;
  saved?: CatalogService;
  values?: Record<string, string>;
  attempt?: number;
}

const SERVICE_FIELDS = ['code', 'name', 'group', 'price', 'active'] as const;

/**
 * Сохранить услугу каталога (SET3): без `code` — новая, с `code` — правка. Проверка — той же функцией домена, что у
 * API, поэтому причина одна; API проверяет ещё раз (право `settings`, «только чтение»). Прошлые начисления не меняются.
 */
export async function saveService(
  prev: ServiceActionResult | null,
  form: FormData,
): Promise<ServiceActionResult> {
  const code = String(form.get('code') ?? '').trim();
  const input = {
    name: String(form.get('name') ?? ''),
    group: String(form.get('group') ?? '').trim() || null,
    price: String(form.get('price') ?? ''),
    active: String(form.get('active') ?? 'true') === 'true',
  };
  const fail = (error: string, field?: ServiceInputField): ServiceActionResult => ({
    error,
    field,
    values: formValues(form, SERVICE_FIELDS),
    attempt: (prev?.attempt ?? 0) + 1,
  });
  const parsed = parseServiceInput(input);
  if (!parsed.ok) return fail(parsed.reason, parsed.field);
  try {
    const saved = code
      ? await serviceCatalogApi.update(code, input)
      : await serviceCatalogApi.create(input);
    revalidatePath('/hotel-settings/services');
    return { error: null, saved };
  } catch (e) {
    return fail(e instanceof ApiError || e instanceof Error ? e.message : String(e));
  }
}

export interface MediaActionResult {
  error: string | null;
}

/** Отказ API словами для человека; сырой текст сервера и трассировка наружу не идут */
function mediaError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 413) return 'Файл больше 10 МиБ';
    if (e.status >= 500 && e.status !== 503) return 'Сервер не ответил. Попробуйте ещё раз.';
    return e.message;
  }
  return 'Не удалось выполнить действие';
}

/** Загрузка фото или договора объекта: файл уходит в API стойки, не в хранилище из браузера (ADR-156, §31.3) */
export async function uploadMediaAction(
  kind: 'photos' | 'contract',
  form: FormData,
): Promise<MediaActionResult> {
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0)
    return { error: kind === 'photos' ? 'Выберите файл: JPEG, PNG или WebP' : 'Выберите файл PDF' };
  if (file.size > 10 * 1024 * 1024) return { error: 'Файл больше 10 МиБ' };
  try {
    await propertyMediaApi.upload(kind, file);
    revalidatePath('/hotel-settings');
    return { error: null };
  } catch (e) {
    return { error: mediaError(e) };
  }
}

export async function removeMediaAction(
  kind: 'photo' | 'contract',
  id?: string,
): Promise<MediaActionResult> {
  try {
    if (kind === 'photo' && id) await propertyMediaApi.removePhoto(id);
    else await propertyMediaApi.removeContract();
    revalidatePath('/hotel-settings');
    return { error: null };
  } catch (e) {
    return { error: mediaError(e) };
  }
}
