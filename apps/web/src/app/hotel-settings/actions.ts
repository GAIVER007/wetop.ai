'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, hotelSettingsApi } from '../../lib/api';
import { formValues } from '../../lib/form-values';

export interface SettingsActionResult {
  error: string | null;
  message: string | null;
  values?: Record<string, string>;
  attempt?: number;
}

/** Поля формы «Общие» — ровно те, что API принимает (DATA_MODEL §1; валюта и пояс — только просмотр) */
const FIELDS = [
  'name',
  'legalName',
  'bin',
  'address',
  'phone',
  'email',
  'checkInTime',
  'checkOutTime',
] as const;

/** Сохранить сведения гостиницы (ТЗ ux-retention п. 3.1): пустое необязательное поле — «нет значения» */
export async function saveHotelSettings(
  prev: SettingsActionResult | null,
  form: FormData,
): Promise<SettingsActionResult> {
  const patch = Object.fromEntries(
    FIELDS.map((name) => {
      const v = String(form.get(name) ?? '').trim();
      return [name, v === '' && name !== 'name' ? null : v];
    }),
  );
  try {
    await hotelSettingsApi.update(patch);
    // название и реквизиты видны в меню, печатных формах и у ИИ-продавца
    revalidatePath('/', 'layout');
    return { error: null, message: 'Сведения гостиницы сохранены' };
  } catch (e) {
    return {
      error: e instanceof ApiError || e instanceof Error ? e.message : String(e),
      message: null,
      values: formValues(form, FIELDS),
      attempt: (prev?.attempt ?? 0) + 1,
    };
  }
}
