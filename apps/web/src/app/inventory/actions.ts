'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, inventoryEditorApi, reservationsApi } from '../../lib/api';
export async function saveInventory(
  resource: 'categories' | 'rooms',
  body: Record<string, unknown>,
  code?: string,
) {
  try {
    await inventoryEditorApi.save(resource, body, code);
  } catch (e) {
    return {
      error:
        e instanceof ApiError
          ? e.message
          : 'Не удалось сохранить. Проверьте результат перед повтором.',
    };
  }
  for (const path of [
    '/inventory',
    '/rooms',
    '/rooms/categories',
    '/rooms/availability',
    '/chessboard',
    '/reservations/new',
    '/rates',
    '/today',
  ])
    revalidatePath(path);
  return { error: null };
}

export async function inventoryRates() {
  try {
    return { plans: await reservationsApi.ratePlans(), error: null };
  } catch {
    return { plans: [], error: 'Не удалось загрузить тарифы. Закройте форму и попробуйте снова.' };
  }
}
