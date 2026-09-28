'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, inventoryEditorApi, reservationsApi } from '../../lib/api';

const FUND_PATHS = [
  '/inventory',
  '/rooms',
  '/rooms/categories',
  '/rooms/availability',
  '/chessboard',
  '/reservations/new',
  '/rates',
  '/today',
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
