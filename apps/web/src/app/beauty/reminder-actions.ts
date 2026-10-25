'use server';
import { unstable_rethrow } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { ApiError, beautyApi } from '../../lib/api';
import { serverT } from '../../i18n/server';

/** «Напомнил»: ручное напоминание отмечено отправленным */
export async function markReminderDone(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await beautyApi.reminderDone(id);
    revalidatePath('/calendar');
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    const t = await serverT();
    return { ok: false, error: error instanceof ApiError ? error.message : t('Не удалось отметить. Попробуйте ещё раз.') };
  }
}
