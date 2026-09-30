'use server';
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { ApiError, businessAgentsApi } from '../../../lib/api';

export async function saveAgentInstruction(id: string, text: string) {
  try {
    const value = await businessAgentsApi.saveInstruction(id, text);
    revalidatePath(`/ai-agents/${encodeURIComponent(id)}`);
    return { ok: true as const, value };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false as const, error: error instanceof ApiError ? error.message : 'Не удалось сохранить. Введённый текст остался в редакторе.' };
  }
}
export async function generateAgentInstruction(id: string, story: string) {
  try { return { ok: true as const, value: await businessAgentsApi.generateInstruction(id, story) }; }
  catch (error) {
    unstable_rethrow(error);
    return { ok: false as const, error: error instanceof ApiError ? error.message : 'Генерация недоступна. Можно написать инструкцию самостоятельно.' };
  }
}
