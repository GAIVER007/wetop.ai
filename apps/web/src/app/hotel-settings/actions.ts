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

/** Поля «Настроек объекта» — ровно те, что API принимает (DATA_MODEL §1; валюта и пояс — только просмотр) */
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
