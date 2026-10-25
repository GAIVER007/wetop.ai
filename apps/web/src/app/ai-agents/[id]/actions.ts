'use server';
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { ApiError, businessAgentsApi } from '../../../lib/api';
import { serverT } from '../../../i18n/server';

export async function saveAgentInstruction(id: string, text: string) {
  try {
    const value = await businessAgentsApi.saveInstruction(id, text);
    revalidatePath(`/ai-agents/${encodeURIComponent(id)}`);
    return { ok: true as const, value };
  } catch (error) {
    unstable_rethrow(error);
    const t = await serverT();
    return { ok: false as const, error: error instanceof ApiError ? error.message : t('Не удалось сохранить. Введённый текст остался в редакторе.') };
  }
}
export async function generateAgentInstruction(id: string, story: string) {
  try { return { ok: true as const, value: await businessAgentsApi.generateInstruction(id, story) }; }
  catch (error) {
    unstable_rethrow(error);
    const t = await serverT();
    return { ok: false as const, error: error instanceof ApiError ? error.message : t('Генерация недоступна. Можно написать инструкцию самостоятельно.') };
  }
}

export async function telegramAction(id: string, action: 'status' | 'check' | 'connect' | 'disconnect', token = '', ids: string[] = []) {
  try {
    if (action === 'check') return {ok: true as const, check: await businessAgentsApi.checkTelegram(id, token)};
    const value = action === 'connect' ? await businessAgentsApi.connectTelegram(id, token, ids) :
      action === 'disconnect' ? await businessAgentsApi.disconnectTelegram(id) : await businessAgentsApi.telegram(id);
    return {ok: true as const, value};
  } catch (error) {
    unstable_rethrow(error);
    const t = await serverT();
    return {ok: false as const, error: t('Не удалось подтвердить подключение. Проверьте готовность сервера, токен и повторите.')};
  }
}
