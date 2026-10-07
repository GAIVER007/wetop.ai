'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, marketingSiteApi } from '../../../lib/api';

/**
 * Действия страницы публикации сайта (MKT7). Каждое зовёт API строгого scope филиала; хост сайта и тариф по умолчанию
 * сервер выбирает сам (тариф не угадывается: без источника API отвечает 409 и просит выбрать). Ответ стойке только
 * текст для человека, без токенов и документа.
 */
export interface PublicationResult {
  error: string | null;
  message: string | null;
}

const describe = (e: unknown) => (e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));

function done(message: string): PublicationResult {
  revalidatePath('/marketing/site');
  return { error: null, message };
}

/** Ссылка превью: возвращается только стойке, которая сразу открывает её в новой вкладке и нигде не хранит */
export async function previewAction(versionId: string): Promise<PublicationResult & { url?: string }> {
  try {
    const { url } = await marketingSiteApi.preview(versionId);
    return { error: null, message: null, url };
  } catch (e) {
    return { error: describe(e), message: null };
  }
}

export async function publishAction(expectedVersionId: string, bookingRatePlanId: string): Promise<PublicationResult> {
  try {
    const result = await marketingSiteApi.publish(expectedVersionId, bookingRatePlanId || undefined);
    return done(result.changed ? 'Версия опубликована' : 'Эта версия уже опубликована');
  } catch (e) {
    return { error: describe(e), message: null };
  }
}

export async function lifecycleAction(kind: 'pause' | 'resume' | 'archive'): Promise<PublicationResult> {
  try {
    if (kind === 'pause') await marketingSiteApi.pause();
    else if (kind === 'resume') await marketingSiteApi.resume();
    else await marketingSiteApi.archive();
    return done(kind === 'pause' ? 'Сайт приостановлен' : kind === 'resume' ? 'Сайт снова открыт' : 'Сайт в архиве');
  } catch (e) {
    return { error: describe(e), message: null };
  }
}

export async function rollbackAction(versionId: string): Promise<PublicationResult> {
  try {
    await marketingSiteApi.rollback(versionId);
    return done('Опубликована выбранная версия');
  } catch (e) {
    return { error: describe(e), message: null };
  }
}

export async function bookingSourceAction(trackedSiteId: string): Promise<PublicationResult> {
  try {
    await marketingSiteApi.setBookingSource(trackedSiteId || null);
    return done(trackedSiteId ? 'Источник бронирования выбран' : 'Источник бронирования снят');
  } catch (e) {
    return { error: describe(e), message: null };
  }
}
