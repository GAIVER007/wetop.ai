'use server';
import { ApiError, channelsApi } from '../../lib/api';
import { serverT } from '../../i18n/server';

/** Одноразовый адрес окна Channex (ADR-140): токен живёт 15 минут, выдаёт API только владельцу */
export async function connectSessionAction(
  channel?: string,
): Promise<{ url: string | null; error: string | null }> {
  const t = await serverT();
  try {
    const r = await channelsApi.connectSession(channel);
    return { url: r.url, error: null };
  } catch (e) {
    return {
      url: null,
      error:
        e instanceof ApiError
          ? e.message
          : t('Не удалось открыть менеджер каналов, попробуйте ещё раз.'),
    };
  }
}

/** «Подтянуть будущие брони»: брони придут обычной лентой менеджера каналов в течение нескольких минут */
export async function loadFutureReservationsAction(
  connectionId: string,
): Promise<{ message: string | null; error: string | null }> {
  const t = await serverT();
  try {
    const r = await channelsApi.loadFutureReservations(connectionId);
    return {
      message: t('{channel}: запрос отправлен. Будущие брони придут в течение нескольких минут и появятся в «Бронях».', { channel: r.channel }),
      error: null,
    };
  } catch (e) {
    return {
      message: null,
      error: e instanceof ApiError ? e.message : t('Не удалось запросить будущие брони, попробуйте ещё раз.'),
    };
  }
}
