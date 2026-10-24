'use server';
import { unstable_rethrow } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { ApiError, beautyApi } from '../../lib/api';

/** «Напомнил»: ручное напоминание отмечено отправленным */
export async function markReminderDone(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await beautyApi.reminderDone(id);
    revalidatePath('/calendar');
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: error instanceof ApiError ? error.message : 'Не удалось отметить. Попробуйте ещё раз.' };
  }
}
