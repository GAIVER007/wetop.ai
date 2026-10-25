'use server';

import { revalidatePath } from 'next/cache';
import { ApiError, authApi, beautyApi, type BeautyMaterialUnit, type BeautyServiceMaterials } from '../../../lib/api';
import type { Translate } from '../../../i18n';
import { serverT } from '../../../i18n/server';

export interface MaterialActionState {
  data?: BeautyServiceMaterials;
  error?: string;
  message?: string;
}

async function scopeMismatch(scopeKey: string, t: Translate): Promise<string | null> {
  if (!scopeKey) return null;
  try {
    const { context } = await authApi.me();
    return context?.locationId === scopeKey
      ? null
      : t('Филиал изменён. Откройте техкарту заново в текущем филиале.');
  } catch {
    return t('Не удалось проверить филиал. Откройте техкарту заново.');
  }
}

const failure = (error: unknown, fallback: string): MaterialActionState => ({
  error: error instanceof ApiError ? error.message : fallback,
});

export async function loadBeautyServiceMaterials(
  serviceId: string,
  scopeKey: string,
): Promise<MaterialActionState> {
  const t = await serverT();
  const mismatch = await scopeMismatch(scopeKey, t);
  if (mismatch) return { error: mismatch };
  try {
    return { data: await beautyApi.serviceMaterials(serviceId) };
  } catch (error) {
    return failure(error, t('Не удалось загрузить техкарту услуги.'));
  }
}

export async function saveBeautyServiceMaterials(
  _previous: MaterialActionState | null,
  form: FormData,
): Promise<MaterialActionState> {
  const serviceId = String(form.get('serviceId') ?? '');
  const scopeKey = String(form.get('scopeKey') ?? '');
  const revisionRaw = form.get('expectedRevision');
  const expectedRevision = typeof revisionRaw === 'string' && /^\d+$/.test(revisionRaw)
    ? Number(revisionRaw)
    : Number.NaN;
  const t = await serverT();
  const mismatch = await scopeMismatch(scopeKey, t);
  if (mismatch) return { error: mismatch };
  if (!serviceId || !Number.isInteger(expectedRevision) || expectedRevision < 0)
    return { error: t('Техкарта устарела. Обновите её перед сохранением.') };

  try {
    const raw: unknown = JSON.parse(String(form.get('items') ?? '[]'));
    if (!Array.isArray(raw)) return { error: t('Проверьте состав техкарты.') };
    const items = raw.map((item) => {
      if (!item || typeof item !== 'object') throw new Error('invalid item');
      const row = item as Record<string, unknown>;
      if (typeof row.productId !== 'string' || typeof row.normQty !== 'string')
        throw new Error('invalid item');
      if (row.unit !== 'г' && row.unit !== 'мл' && row.unit !== 'шт') // kk-allow: единицы это значения API для сверки
        throw new Error('invalid item');
      return { productId: row.productId, normQty: row.normQty, unit: row.unit as BeautyMaterialUnit };
    });
    const data = await beautyApi.saveServiceMaterials(serviceId, { expectedRevision, items });
    revalidatePath('/beauty/services');
    return { data, message: t('Техкарта сохранена') };
  } catch (error) {
    return error instanceof SyntaxError || (error instanceof Error && error.message === 'invalid item')
      ? { error: t('Проверьте состав техкарты.') }
      : failure(error, t('Не удалось сохранить техкарту. Обновите данные перед повтором.'));
  }
}
