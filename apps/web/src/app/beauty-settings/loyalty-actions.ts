'use server';
import { unstable_rethrow } from 'next/navigation';
import { parseBonusProgram, parseReminderSettings } from '@pms/domain';
import {
  ApiError,
  authApi,
  beautyApi,
  type BeautyBonusProgram,
  type BeautyReminderSettings,
} from '../../lib/api';
import { serverT } from '../../i18n/server';

type Result<T> = { data?: T; error?: string };

async function sameScope(form: FormData): Promise<boolean> {
  const expected = JSON.parse(String(form.get('scopeKey') ?? '{}')) as Record<string, unknown>;
  const me = await authApi.me();
  return Boolean(
    expected.organizationId &&
      expected.businessId &&
      me.user?.organizationId === expected.organizationId &&
      me.context?.businessId === expected.businessId &&
      (!expected.locationId || me.context?.locationId === expected.locationId),
  );
}

/** «Напоминания клиентам»: часы через запятую, пустой текст значит текст по умолчанию */
export async function saveReminderSettings(
  _previous: Result<BeautyReminderSettings> | null,
  form: FormData,
): Promise<Result<BeautyReminderSettings>> {
  const t = await serverT();
  try {
    if (!(await sameScope(form))) return { error: t('Контекст изменён. Откройте настройки нужного филиала.') };
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
    return { data: await beautyApi.saveReminderSettings(parsed.value) };
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof ApiError ? error.message : t('Не удалось сохранить напоминания. Ввод сохранён.') };
  }
}

/** «Бонусы»: проценты целые, срок пустой значит без срока */
export async function saveBonusProgram(
  _previous: Result<BeautyBonusProgram> | null,
  form: FormData,
): Promise<Result<BeautyBonusProgram>> {
  const t = await serverT();
  try {
    if (!(await sameScope(form))) return { error: t('Контекст изменён. Откройте настройки нужного салона.') };
    const expires = String(form.get('expiresDays') ?? '').trim();
    const parsed = parseBonusProgram({
      expectedRevision: Number(form.get('revision')),
      enabled: form.get('enabled') === 'on',
      accrualPercent: Number(form.get('accrualPercent')),
      maxRedeemPercent: Number(form.get('maxRedeemPercent')),
      expiresDays: expires ? Number(expires) : null,
    });
    if (!parsed.ok) return { error: parsed.reason };
    return { data: await beautyApi.saveBonusProgram(parsed.value) };
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof ApiError ? error.message : t('Не удалось сохранить бонусы. Ввод сохранён.') };
  }
}
