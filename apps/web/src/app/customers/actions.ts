'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, beautyApi, type BeautyCustomerImportPreview } from '../../lib/api';
import { deskShell } from '../../lib/desk-shell';
import { BeautyCustomerXlsxError, parseBeautyCustomersXlsx } from './xlsx';

export type CustomerActionResult = { error: string | null; message?: string };
export type CustomerImportPreviewResult = CustomerActionResult & { preview?: BeautyCustomerImportPreview };

const messageOf = (error: unknown) => {
  if (error instanceof ApiError) return error.message;
  throw error;
};

async function assertCustomerScope(form: FormData): Promise<void> {
  const captured = String(form.get('scopeKey') ?? '');
  const current = (await deskShell()).scopeKey;
  if (!captured || !current || captured !== current) {
    throw new ApiError(409, 'Филиал изменился. Обновите страницу и повторите действие.');
  }
}

async function customerFileCsv(form: FormData): Promise<string> {
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) throw new ApiError(400, 'Выберите CSV- или XLSX-файл');
  if (file.size > 100 * 1024) throw new ApiError(400, 'Файл должен быть не больше 100 КБ');
  const bytes = await file.arrayBuffer();
  const data = new Uint8Array(bytes);
  const isXlsx = file.name.toLocaleLowerCase('ru').endsWith('.xlsx')
    || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    || (data[0] === 0x50 && data[1] === 0x4b);
  if (isXlsx) {
    try {
      return await parseBeautyCustomersXlsx(data);
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

export async function createBeautyCustomer(form: FormData): Promise<CustomerActionResult> {
  try {
    await assertCustomerScope(form);
    await beautyApi.createCustomer({
      firstName: String(form.get('firstName') ?? ''),
      lastName: String(form.get('lastName') ?? ''),
      phone: String(form.get('phone') ?? ''),
    });
    revalidatePath('/customers');
    return { error: null, message: 'Клиент добавлен' };
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
    return {
      error: null,
      message: `Создано: ${result.created}. Добавлено в салон: ${result.linked}. Уже были: ${result.alreadyExists}.`,
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
