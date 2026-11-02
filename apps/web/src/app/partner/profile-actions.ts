'use server';
import { revalidatePath } from 'next/cache';
import { partnerApi } from '../../lib/api';
import { ApiError } from '../../lib/api-error';

/** «Мой профиль» партнёра (DATA_MODEL §63.4): только поля, которые он меняет сам */
export async function savePartnerProfileAction(
  _prev: { error: string | null; saved: boolean } | null,
  form: FormData,
): Promise<{ error: string | null; saved: boolean }> {
  const f = (k: string) => String(form.get(k) ?? '').trim();
  try {
    await partnerApi.saveProfile({ specialization: f('specialization'), city: f('city'), experienceYears: f('experienceYears'), about: f('about'), phone: f('phone') });
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Не получилось. Повторите через минуту.', saved: false };
  }
  revalidatePath('/partner');
  return { error: null, saved: true };
}
