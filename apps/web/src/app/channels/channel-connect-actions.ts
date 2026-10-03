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

/** «Подтянуть будущие брони»: брони придут обычной лентой менеджера каналов в течение нескольких минут */
export async function loadFutureReservationsAction(
  connectionId: string,
): Promise<{ message: string | null; error: string | null }> {
  try {
    const r = await channelsApi.loadFutureReservations(connectionId);
    return {
      message: `${r.channel}: запрос отправлен. Будущие брони придут в течение нескольких минут и появятся в «Бронях».`,
      error: null,
    };
  } catch (e) {
    return {
      message: null,
      error: e instanceof ApiError ? e.message : 'Не удалось запросить будущие брони, попробуйте ещё раз.',
    };
  }
}
