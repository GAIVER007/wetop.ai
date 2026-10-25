'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, authApi, beautyApi, type BeautyCustomerImportPreview } from '../../lib/api';
import { deskShell } from '../../lib/desk-shell';
import { BeautyCustomerXlsxError, parseBeautyCustomersXlsx } from './xlsx';
import { serverT } from '../../i18n/server';

export type CustomerActionResult = { error: string | null; message?: string };
export type CustomerImportPreviewResult = CustomerActionResult & { preview?: BeautyCustomerImportPreview };
export interface CreateCustomerState {
  error?: string;
  id?: string;
  created?: boolean;
}

const messageOf = (error: unknown) => {
  if (error instanceof ApiError) return error.message;
  throw error;
};

async function assertCustomerScope(form: FormData): Promise<void> {
  const captured = String(form.get('scopeKey') ?? '');
  const current = (await deskShell()).scopeKey;
  if (!captured || !current || captured !== current) {
    const t = await serverT();
    throw new ApiError(409, t('Филиал изменился. Обновите страницу и повторите действие.'));
  }
}

async function customerFileCsv(form: FormData): Promise<string> {
  const t = await serverT();
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) throw new ApiError(400, t('Выберите CSV- или XLSX-файл'));
  if (file.size > 100 * 1024) throw new ApiError(400, t('Файл должен быть не больше 100 КБ'));
  const bytes = await file.arrayBuffer();
  const data = new Uint8Array(bytes);
  const isXlsx = file.name.toLocaleLowerCase('ru').endsWith('.xlsx')
    || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    || (data[0] === 0x50 && data[1] === 0x4b);
  if (isXlsx) {
    try {
      return await parseBeautyCustomersXlsx(data, t);
    } catch (error) {
      if (error instanceof BeautyCustomerXlsxError) throw new ApiError(400, error.message);
      throw error;
    }
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1251').decode(bytes);
  }
}

// Server Actions должны быть async-функциями: перегрузки TypeScript Next.js не принимает, поэтому две функции
/** Кнопка «Добавить клиента» в инструментах списка: результат сообщением */
export async function createBeautyCustomer(form: FormData): Promise<CustomerActionResult> {
  return (await createCustomer(form, false)) as CustomerActionResult;
}

/** Форма с useActionState: id созданного или найденного клиента */
export async function createBeautyCustomerState(
  _previous: CreateCustomerState | null,
  form: FormData,
): Promise<CreateCustomerState> {
  return (await createCustomer(form, true)) as CreateCustomerState;
}

async function createCustomer(
  form: unknown,
  stateAction: boolean,
): Promise<CustomerActionResult | CreateCustomerState> {
  const t = await serverT();
  if (!(form instanceof FormData)) return { error: t('Не удалось прочитать форму клиента') };
  try {
    if (stateAction) {
      const expectedBusinessId = String(form.get('businessId') ?? '');
      const { context } = await authApi.me();
      if (!expectedBusinessId || context?.businessId !== expectedBusinessId)
        return { error: t('Бизнес изменён. Закройте форму и откройте её в текущем салоне.') };
    } else {
      await assertCustomerScope(form);
    }
    const result = await beautyApi.createCustomer({
      firstName: String(form.get('firstName') ?? ''),
      lastName: String(form.get('lastName') ?? ''),
      phone: String(form.get('phone') ?? ''),
    });
    revalidatePath('/customers');
    return stateAction
      ? result
      : {
          error: null,
          message: result.created
            ? t('Клиент добавлен')
            : t('Клиент уже есть. Используем существующую карточку.'),
        };
  } catch (error) {
    return { error: messageOf(error) };
  }
}

export async function previewBeautyCustomerImport(form: FormData): Promise<CustomerImportPreviewResult> {
  try {
    await assertCustomerScope(form);
    return { error: null, preview: await beautyApi.previewCustomerImport(await customerFileCsv(form)) };
  } catch (error) {
    return { error: messageOf(error) };
  }
}

export async function applyBeautyCustomerImport(form: FormData): Promise<CustomerActionResult> {
  try {
    await assertCustomerScope(form);
    const result = await beautyApi.importCustomers(await customerFileCsv(form));
    revalidatePath('/customers');
    const t = await serverT();
    return {
      error: null,
      message: t('Создано: {created}. Добавлено в салон: {linked}. Уже были: {existing}.', {
        created: result.created,
        linked: result.linked,
        existing: result.alreadyExists,
      }),
    };
  } catch (error) {
    return { error: messageOf(error) };
  }
}

/** VIP и день рождения клиента салона (§36): ответ API словами, как у ресторана */
export async function markBeautyCustomer(
  id: string,
  body: { isVip: boolean; birthDate: string | null },
): Promise<{ error: string | null }> {
  try {
    await beautyApi.updateCustomer(id, body);
    revalidatePath('/customers');
    return { error: null };
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
}
