'use server';
import { revalidatePath } from 'next/cache';
import {
  ApiError,
  inventoryEditorApi,
  reservationsApi,
  siteAssetsApi,
  unitsApi,
  type SiteAssetView,
} from '../../lib/api';

const FUND_PATHS = [
  '/inventory',
  '/rooms',
  '/rooms/categories',
  '/rooms/availability',
  '/chessboard',
  '/reservations/new',
  '/finance',
];
const failure = (e: unknown) =>
  e instanceof ApiError ? e.message : 'Не удалось сохранить. Проверьте результат перед повтором.';

/** `code` — код созданной категории: форма ведёт к следующему шагу с ней (ADR-119) */
export async function saveInventory(
  resource: 'categories' | 'rooms',
  body: Record<string, unknown>,
  code?: string,
): Promise<{ error: string | null; code?: string }> {
  let saved: { code?: string } | undefined;
  try {
    saved = await inventoryEditorApi.save(resource, body, code);
  } catch (e) {
    return { error: failure(e) };
  }
  for (const path of FUND_PATHS) revalidatePath(path);
  return { error: null, ...(saved?.code ? { code: saved.code } : {}) };
}

/** «Удалить» категорию: ответ сервера говорит, удалена она насовсем или ушла в архив */
export async function removeCategory(
  code: string,
): Promise<{ error: string | null; result?: 'deleted' | 'archived' }> {
  let result: 'deleted' | 'archived';
  try {
    result = (await inventoryEditorApi.remove(code)).result;
  } catch (e) {
    return { error: failure(e) };
  }
  for (const path of FUND_PATHS) revalidatePath(path);
  return { error: null, result };
}

/** «Настроить тариф» (ADR-119): привязать существующий или новый тариф к категории */
export async function linkCategoryRatePlan(code: string, body: Record<string, unknown>) {
  try {
    await inventoryEditorApi.linkRatePlan(code, body);
  } catch (e) {
    return { error: failure(e) };
  }
  for (const path of FUND_PATHS) revalidatePath(path);
  return { error: null };
}

export async function inventoryRates() {
  try {
    return { plans: await reservationsApi.ratePlans(), error: null };
  } catch {
    return { plans: [], error: 'Не удалось загрузить тарифы. Закройте форму и попробуйте снова.' };
  }
}

const HK_STATUSES = ['DIRTY', 'CLEAN', 'INSPECTED'];

/**
 * Массовая смена уборки (F2): каждое место проходит ту же проверку цикла «требует уборки → убрано → проверено»,
 * что и по одному. Не прошедшие (перепрыгнули шаг, место не найдено) пропускаются и считаются отдельно.
 */
export async function bulkHousekeepingAction(
  codes: string[],
  status: string,
): Promise<{ done: number; skipped: number; reason: string | null }> {
  if (!HK_STATUSES.includes(status) || codes.length === 0 || codes.length > 200)
    return { done: 0, skipped: codes.length, reason: 'Выберите от 1 до 200 мест и статус уборки' };
  let done = 0;
  let skipped = 0;
  let reason: string | null = null;
  for (const code of codes) {
    try {
      await unitsApi.housekeeping(code, status);
      done++;
    } catch (e) {
      skipped++;
      reason ??= failure(e);
    }
  }
  for (const path of FUND_PATHS) revalidatePath(path);
  return { done, skipped, reason };
}

/** Библиотека изображений филиала для выбора фото категории: только готовые картинки, без логотипов и фавиконок */
export async function loadPhotoLibraryAction(): Promise<{
  error: string | null;
  assets: SiteAssetView[];
  storageOff: boolean;
}> {
  try {
    const lib = await siteAssetsApi.list();
    return {
      error: null,
      storageOff: lib.storage === 'OFF',
      assets: lib.assets.filter((a) => a.kind === 'IMAGE'),
    };
  } catch (e) {
    return { error: failure(e), assets: [], storageOff: false };
  }
}

export async function saveCategoryPhotosAction(
  code: string,
  assetIds: string[],
): Promise<{ error: string | null }> {
  try {
    await inventoryEditorApi.setPhotos(code, assetIds);
  } catch (e) {
    return { error: failure(e) };
  }
  for (const path of FUND_PATHS) revalidatePath(path);
  return { error: null };
}
