'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, hotelSettingsApi, serviceCatalogApi, type CatalogService } from '../../lib/api';
import { parseServiceInput, type ServiceInputField } from '@pms/domain';
import { formValues } from '../../lib/form-values';

export interface SettingsActionResult {
  error: string | null;
  message: string | null;
  values?: Record<string, string>;
  attempt?: number;
}

/** Поля «Настроек объекта» — ровно те, что API принимает (DATA_MODEL §1; валюта и пояс — только просмотр) */
const FIELDS = [
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
] as const;

/**
 * Сохранить сведения объекта (ТЗ ux-retention п. 3.1): пустое необязательное поле — «нет значения». Уходят только
 * поля, которые есть в форме: у «Основного» и «Проживания» свои формы (ADR-115), и одна не должна стирать другую.
 */
export async function saveHotelSettings(
  prev: SettingsActionResult | null,
  form: FormData,
): Promise<SettingsActionResult> {
  const present = FIELDS.filter((name) => form.has(name));
  const patch = Object.fromEntries(
    present.map((name) => {
      const v = String(form.get(name) ?? '').trim();
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
      values: formValues(form, present),
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
