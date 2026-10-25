'use server';
import { revalidatePath } from 'next/cache';
import {
  ApiError,
  financeApi,
  hotelSettingsApi,
  paymentMethodsApi,
  propertyMediaApi,
  serviceCatalogApi,
  type CatalogService,
} from '../../lib/api';
import {
  parsePaymentMethodSettings,
  parseServiceInput,
  type ServiceInputField,
} from '@pms/domain';
import { formValues } from '../../lib/form-values';
import { serverT } from '../../i18n/server';

export interface SettingsActionResult {
  error: string | null;
  message: string | null;
  values?: Record<string, string>;
  attempt?: number;
}

/** Поля «Настроек объекта» — ровно те, что API принимает (DATA_MODEL §1 и §32; валюта и пояс — только просмотр) */
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
 * Карточка (ADR-158): выключатели приходят булевыми, удобства списком кодов, возраст числом.
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
  const t = await serverT();
  try {
    await hotelSettingsApi.update(patch);
    // название и реквизиты видны в меню, печатных формах и у ИИ-продавца
    revalidatePath('/', 'layout');
    return { error: null, message: t('Изменения сохранены') };
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

/** Итог действий «Справочников» (ADR-185): ошибка словами или сообщение об успехе */
export interface DirectoryActionResult {
  error: string | null;
  message: string | null;
}
const fail = (e: unknown): DirectoryActionResult => ({
  error: e instanceof ApiError || e instanceof Error ? e.message : String(e),
  message: null,
});

/**
 * Сохранить способы оплаты объекта (DATA_MODEL §21.6): форма шлёт весь список в порядке показа; проверка той же
 * функцией домена, что у API, поэтому причина отказа одна. API проверяет ещё раз (право `settings`).
 */
export async function savePaymentMethods(
  _prev: DirectoryActionResult | null,
  form: FormData,
): Promise<DirectoryActionResult> {
  const t = await serverT();
  let methods: unknown;
  try {
    methods = JSON.parse(String(form.get('methods') ?? '[]'));
  } catch {
    return { error: t('Список способов не прочитан, обновите страницу'), message: null };
  }
  const parsed = parsePaymentMethodSettings({ methods });
  if (!parsed.ok) return { error: parsed.reason, message: null };
  try {
    await paymentMethodsApi.update(parsed.value);
  } catch (e) {
    return fail(e);
  }
  revalidatePath('/hotel-settings/directories');
  return { error: null, message: t('Способы оплаты сохранены') };
}

/** Статья кассы: без `id` новая, с `id` переименование или выключение; удаления нет (§21) */
export async function saveCashCategory(
  _prev: DirectoryActionResult | null,
  form: FormData,
): Promise<DirectoryActionResult> {
  const t = await serverT();
  const id = String(form.get('id') ?? '').trim();
  const name = form.get('name');
  const active = form.get('active');
  try {
    if (!id) {
      await financeApi.createCashCategory({
        kind: String(form.get('kind') ?? ''),
        name: String(name ?? ''),
      });
    } else {
      const patch: { name?: string; active?: boolean } = {};
      if (typeof name === 'string') patch.name = name;
      if (typeof active === 'string') patch.active = active === 'true';
      await financeApi.updateCashCategory(id, patch);
    }
  } catch (e) {
    return fail(e);
  }
  revalidatePath('/hotel-settings/directories');
  revalidatePath('/finance');
  return { error: null, message: id ? t('Статья сохранена') : t('Статья добавлена') };
}

export interface MediaActionResult {
  error: string | null;
}

/** Отказ API словами для человека; сырой текст сервера и трассировка наружу не идут */
async function mediaError(e: unknown): Promise<string> {
  const t = await serverT();
  if (e instanceof ApiError) {
    if (e.status === 413) return t('Файл больше 10 МиБ');
    if (e.status >= 500 && e.status !== 503) return t('Сервер не ответил. Попробуйте ещё раз.');
    return e.message;
  }
  return t('Не удалось выполнить действие');
}

/** Загрузка фото или договора объекта: файл уходит в API стойки, не в хранилище из браузера (ADR-158, §32.3) */
export async function uploadMediaAction(
  kind: 'photos' | 'contract',
  form: FormData,
): Promise<MediaActionResult> {
  const t = await serverT();
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0)
    return { error: kind === 'photos' ? t('Выберите файл: JPEG, PNG или WebP') : t('Выберите файл PDF') };
  if (file.size > 10 * 1024 * 1024) return { error: t('Файл больше 10 МиБ') };
  try {
    await propertyMediaApi.upload(kind, file);
    revalidatePath('/hotel-settings');
    return { error: null };
  } catch (e) {
    return { error: await mediaError(e) };
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
    return { error: await mediaError(e) };
  }
}
