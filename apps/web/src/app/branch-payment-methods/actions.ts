'use server';
import { revalidatePath } from 'next/cache';
import { parseBranchPaymentMethodSettings } from '@pms/domain';
import { ApiError, authApi } from '../../lib/api';
import { restaurantApi } from '../../lib/food-api';
import type { DirectoryActionResult } from '../hotel-settings/actions';

/** Тот же филиал, что был открыт: иначе сохранение ушло бы в филиал, выбранный в другой вкладке */
async function sameScope(form: FormData): Promise<boolean> {
  const expected = String(form.get('scopeKey') ?? '');
  const me = await authApi.me();
  return Boolean(expected) && expected === `${me.context?.businessId}:${me.context?.locationId}`;
}

/** Способы оплаты филиала салона и ресторана (DATA_MODEL §21.7): тот же разбор, что у API */
export async function saveBranchPaymentMethods(
  _prev: DirectoryActionResult | null,
  form: FormData,
): Promise<DirectoryActionResult> {
  let methods: unknown;
  try {
    methods = JSON.parse(String(form.get('methods') ?? '[]'));
  } catch {
    return { error: 'Список способов не прочитан, обновите страницу', message: null };
  }
  const parsed = parseBranchPaymentMethodSettings({ methods });
  if (!parsed.ok) return { error: parsed.reason, message: null };
  try {
    if (!(await sameScope(form)))
      return { error: 'Выбран другой филиал. Откройте настройки нужного филиала.', message: null };
    await restaurantApi.updatePaymentMethods(parsed.value);
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Не удалось сохранить, попробуйте ещё раз', message: null };
  }
  revalidatePath('/branch-payment-methods');
  return { error: null, message: 'Способы оплаты сохранены' };
}
