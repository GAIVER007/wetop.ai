'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, platformApi } from '../../../../lib/api';
import { serverT } from '../../../../i18n/server';

export type ConnectBuilderResult = { ok: true } | { ok: false; error: string };

/**
 * Подключение конструктора сайта из окна «Сайт и SEO» (владелец 29.10.2026). Права проверяет API: только главный
 * администратор WETOP, филиал только этой организации, запись в журнал `site_builder.entitlement_updated`.
 */
export async function connectBuilderAction(_prev: ConnectBuilderResult | null, form: FormData): Promise<ConnectBuilderResult> {
  const t = await serverT();
  const organizationId = String(form.get('organizationId') ?? '');
  const locationId = String(form.get('locationId') ?? '');
  const status = form.get('status') === 'ACTIVE' ? 'ACTIVE' : 'TRIAL';
  try {
    await platformApi.changeSiteBuilder(organizationId, locationId, {
      status,
      activeUntil: String(form.get('activeUntil') ?? '').trim(),
      note: String(form.get('note') ?? '').trim(),
    });
    revalidatePath('/marketing');
    revalidatePath('/marketing/site/editor');
    revalidatePath('/platform');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof ApiError || e instanceof Error ? e.message : t('Не удалось подключить') };
  }
}
