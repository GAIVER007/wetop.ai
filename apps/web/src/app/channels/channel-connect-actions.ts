'use server';
import { ApiError, channelsApi } from '../../lib/api';

/** Одноразовый адрес окна Channex (ADR-138): токен живёт 15 минут, выдаёт API только владельцу */
export async function connectSessionAction(
  channel?: string,
): Promise<{ url: string | null; error: string | null }> {
  try {
    const r = await channelsApi.connectSession(channel);
    return { url: r.url, error: null };
  } catch (e) {
    return {
      url: null,
      error:
        e instanceof ApiError
          ? e.message
          : 'Не удалось открыть менеджер каналов — попробуйте ещё раз.',
    };
  }
}
