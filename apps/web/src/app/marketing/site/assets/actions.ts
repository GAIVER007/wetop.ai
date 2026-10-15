'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, siteAssetsApi, type ChannexPhotoChoice } from '../../../../lib/api';

/**
 * Действия библиотеки изображений сайта (MKT8). Файл уходит в API стойки (не в хранилище из браузера): там проверка по
 * содержимому, снятие EXIF и запись в приватное хранилище. Ответ стойке только текст для человека.
 */
export interface AssetResult {
  error: string | null;
  message: string | null;
}

const MAX_BYTES = 10 * 1024 * 1024;

/** Отказы API словами: сырого текста сервера и трассировки человек не видит */
function describe(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 413) return 'Файл больше 10 МиБ';
    if (e.status === 429) return 'Лимит загрузок изображений за час исчерпан. Попробуйте позже.';
    if (e.status >= 500 && e.status !== 503) return 'Сервер не ответил. Попробуйте ещё раз.';
    return e.message;
  }
  return 'Не удалось выполнить действие';
}

function done(message: string): AssetResult {
  revalidatePath('/marketing/site/assets');
  return { error: null, message };
}

export async function uploadAssetAction(_prev: AssetResult | null, form: FormData): Promise<AssetResult> {
  const file = form.get('file');
  const kind = String(form.get('kind') ?? 'IMAGE');
  if (!(file instanceof File) || file.size === 0) return { error: 'Выберите файл: JPEG, PNG или WebP', message: null };
  if (file.size > MAX_BYTES) return { error: 'Файл больше 10 МиБ', message: null };
  try {
    const r = await siteAssetsApi.upload(file, kind);
    return done(r.created ? 'Изображение загружено' : 'Такое изображение уже есть в библиотеке');
  } catch (e) {
    return { error: describe(e), message: null };
  }
}

export async function updateAltAction(id: string, ru: string): Promise<AssetResult> {
  try {
    await siteAssetsApi.updateAlt(id, ru.trim() ? { ru: ru.trim() } : null);
    return done('Подпись сохранена');
  } catch (e) {
    return { error: describe(e), message: null };
  }
}

export async function deleteAssetAction(id: string): Promise<AssetResult> {
  try {
    const r = await siteAssetsApi.remove(id);
    return done(
      r.retainedForPublishedHistory
        ? 'Изображение скрыто из библиотеки, но сохранено для опубликованных версий и отката'
        : 'Изображение удалено',
    );
  } catch (e) {
    return { error: describe(e), message: null };
  }
}

export async function channexPhotosAction(): Promise<AssetResult & { state?: string; photos?: ChannexPhotoChoice[] }> {
  try {
    const r = await siteAssetsApi.channexPhotos();
    return { error: null, message: null, state: r.state, photos: r.photos };
  } catch (e) {
    return { error: describe(e), message: null };
  }
}

const FAILURE: Record<string, string> = {
  UNKNOWN_PHOTO: 'фото больше нет в менеджере каналов',
  HOST_NOT_PUBLIC: 'адрес фото недоступен',
  URL_REJECTED: 'адрес фото недоступен',
  UNSUPPORTED_MEDIA_TYPE: 'не JPEG, PNG или WebP',
  IMAGE_DECODE_FAILED: 'файл повреждён',
  IMAGE_TOO_LARGE: 'слишком большое изображение',
  TOO_LARGE: 'файл больше 10 МиБ',
};

export async function importChannexAction(photoIds: string[]): Promise<AssetResult> {
  try {
    const r = await siteAssetsApi.importChannex(photoIds);
    const parts = [`Импортировано: ${r.imported.length}`];
    if (r.failed.length)
      parts.push(`не удалось: ${r.failed.length} (${[...new Set(r.failed.map((f) => FAILURE[f.code] ?? 'ошибка загрузки'))].join(', ')})`);
    revalidatePath('/marketing/site/assets');
    return { error: r.imported.length === 0 && r.failed.length ? parts.join(', ') : null, message: r.imported.length ? parts.join(', ') : null };
  } catch (e) {
    return { error: describe(e), message: null };
  }
}
