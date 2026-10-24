'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, siteAssetsApi, type ChannexPhotoChoice } from '../../../../lib/api';
import { msg, type Translate } from '../../../../i18n';
import { serverT } from '../../../../i18n/server';

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
function describe(e: unknown, t: Translate): string {
  if (e instanceof ApiError) {
    if (e.status === 413) return t('Файл больше 10 МиБ');
    if (e.status === 429) return t('Лимит загрузок изображений за час исчерпан. Попробуйте позже.');
    if (e.status >= 500 && e.status !== 503) return t('Сервер не ответил. Попробуйте ещё раз.');
    return e.message;
  }
  return t('Не удалось выполнить действие');
}

function done(message: string): AssetResult {
  revalidatePath('/marketing/site/assets');
  return { error: null, message };
}

export async function uploadAssetAction(_prev: AssetResult | null, form: FormData): Promise<AssetResult> {
  const file = form.get('file');
  const kind = String(form.get('kind') ?? 'IMAGE');
  const t = await serverT();
  if (!(file instanceof File) || file.size === 0) return { error: t('Выберите файл: JPEG, PNG или WebP'), message: null };
  if (file.size > MAX_BYTES) return { error: t('Файл больше 10 МиБ'), message: null };
  try {
    const r = await siteAssetsApi.upload(file, kind);
    return done(r.created ? t('Изображение загружено') : t('Такое изображение уже есть в библиотеке'));
  } catch (e) {
    return { error: describe(e, t), message: null };
  }
}

export async function updateAltAction(id: string, ru: string): Promise<AssetResult> {
  const t = await serverT();
  try {
    await siteAssetsApi.updateAlt(id, ru.trim() ? { ru: ru.trim() } : null);
    return done(t('Подпись сохранена'));
  } catch (e) {
    return { error: describe(e, t), message: null };
  }
}

export async function deleteAssetAction(id: string): Promise<AssetResult> {
  const t = await serverT();
  try {
    const r = await siteAssetsApi.remove(id);
    return done(
      r.retainedForPublishedHistory
        ? t('Изображение скрыто из библиотеки, но сохранено для опубликованных версий и отката')
        : t('Изображение удалено'),
    );
  } catch (e) {
    return { error: describe(e, t), message: null };
  }
}

export async function channexPhotosAction(): Promise<AssetResult & { state?: string; photos?: ChannexPhotoChoice[] }> {
  const t = await serverT();
  try {
    const r = await siteAssetsApi.channexPhotos();
    return { error: null, message: null, state: r.state, photos: r.photos };
  } catch (e) {
    return { error: describe(e, t), message: null };
  }
}

const FAILURE: Record<string, string> = {
  UNKNOWN_PHOTO: msg('фото больше нет в менеджере каналов'),
  HOST_NOT_PUBLIC: msg('адрес фото недоступен'),
  URL_REJECTED: msg('адрес фото недоступен'),
  UNSUPPORTED_MEDIA_TYPE: msg('не JPEG, PNG или WebP'),
  IMAGE_DECODE_FAILED: msg('файл повреждён'),
  IMAGE_TOO_LARGE: msg('слишком большое изображение'),
  TOO_LARGE: msg('файл больше 10 МиБ'),
};

export async function importChannexAction(photoIds: string[]): Promise<AssetResult> {
  const t = await serverT();
  try {
    const r = await siteAssetsApi.importChannex(photoIds);
    const parts = [t('Импортировано: {n}', { n: r.imported.length })];
    if (r.failed.length) {
      const reasons = [...new Set(r.failed.map((f) => t(FAILURE[f.code] ?? msg('ошибка загрузки'))))].join(', ');
      parts.push(t('не удалось: {n} ({reasons})', { n: r.failed.length, reasons }));
    }
    revalidatePath('/marketing/site/assets');
    return { error: r.imported.length === 0 && r.failed.length ? parts.join(', ') : null, message: r.imported.length ? parts.join(', ') : null };
  } catch (e) {
    return { error: describe(e, t), message: null };
  }
}
