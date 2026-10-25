'use server';
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { parseReminderSettings } from '@pms/domain';
import { ApiError } from '../../lib/api';
import { currentMe } from '../../lib/desk-shell';
import { foodApi, type FoodReminderSettings } from '../../lib/food-api';
import { msg } from '../../i18n';
import { serverT } from '../../i18n/server';

type Result<T> = { data?: T; error?: string };

/** Ключ филиала ресторана `businessId:locationId` (как у часов работы): форма другого филиала не сохраняется */
async function sameScope(form: FormData): Promise<boolean> {
  const me = await currentMe();
  const c = me.context;
  return Boolean(
    me.user && c?.vertical === 'FOOD_SERVICE' && c.businessId && c.locationId && String(form.get('scopeKey') ?? '') === `${c.businessId}:${c.locationId}`,
  );
}

/** «Напоминания гостям» (§61): часы через запятую, пустой текст значит текст по умолчанию; проверка как у салона */
export async function saveFoodReminderSettings(
  _previous: Result<FoodReminderSettings> | null,
  form: FormData,
): Promise<Result<FoodReminderSettings>> {
  try {
    if (!(await sameScope(form))) return { error: (await serverT())(msg('Контекст изменён. Откройте настройки нужного филиала.')) };
    const hours = String(form.get('hoursBefore') ?? '')
      .split(/[,\s]+/)
      .filter(Boolean)
      .map(Number);
    const parsed = parseReminderSettings({
      expectedRevision: Number(form.get('revision')),
      enabled: form.get('enabled') === 'on',
      hoursBefore: hours,
      template: String(form.get('template') ?? ''),
      whatsappTemplateName: String(form.get('whatsappTemplateName') ?? ''),
    });
    if (!parsed.ok) return { error: parsed.reason };
    return { data: await foodApi.saveReminderSettings(parsed.value) };
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof ApiError ? error.message : (await serverT())(msg('Не удалось сохранить напоминания. Ввод сохранён.')) };
  }
}

/** «Напомнил»: ручное напоминание гостю отмечено отправленным */
export async function markFoodReminderDone(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await foodApi.reminderDone(id);
    revalidatePath('/floor-plan');
    revalidatePath('/table-reservations');
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: error instanceof ApiError ? error.message : (await serverT())(msg('Не удалось отметить. Попробуйте ещё раз.')) };
  }
}
