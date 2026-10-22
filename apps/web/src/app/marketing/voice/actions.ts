'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, marketingVoiceApi } from '../../../lib/api';
import type { BudgetActionResult } from '../budget/actions';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Слова сервера (ApiError) показываем, текст сетевых и внутренних исключений нет: в нём адреса и коды (аудит 17.10.2026, Д11) */
const describe = (e: unknown) => (e instanceof ApiError ? e.message : 'Не удалось сохранить. Попробуйте ещё раз.');

/** «Отметить обработанной»: просьба перезвонить закрыта, раздел и хаб обновляются */
export async function closeCallbackAction(_prev: BudgetActionResult, fd: FormData): Promise<BudgetActionResult> {
  const raw = fd.get('callbackId');
  const id = typeof raw === 'string' ? raw.trim() : '';
  if (!UUID.test(id)) return { error: 'Не удалось определить просьбу. Обновите страницу.', ok: 0 };
  try {
    await marketingVoiceApi.closeCallback(id);
  } catch (e) {
    return { error: describe(e), ok: 0 };
  }
  revalidatePath('/marketing/voice');
  revalidatePath('/marketing');
  return { error: null, ok: Date.now(), message: 'Просьба отмечена как обработанная' };
}
