'use server';
import { unstable_rethrow } from 'next/navigation';
import { parseWorkingHoursWeek } from '@pms/domain';
import { ApiError, authApi, beautyApi, type BeautyLocationHoursResponse } from '../../lib/api';
import { serverT } from '../../i18n/server';

export async function saveSalonHours(
  _previous: { data?: BeautyLocationHoursResponse; error?: string } | null,
  form: FormData,
): Promise<{ data?: BeautyLocationHoursResponse; error?: string }> {
  const t = await serverT();
  try {
    const expected = JSON.parse(String(form.get('scopeKey') ?? '')) as Record<string, unknown>;
    const me = await authApi.me();
    if (
      !expected.organizationId ||
      !expected.businessId ||
      !expected.locationId ||
      me.user?.organizationId !== expected.organizationId ||
      me.context?.businessId !== expected.businessId ||
      me.context?.locationId !== expected.locationId
    )
      return { error: t('Контекст изменён. Откройте настройки нужного филиала.') };
    const parsed = parseWorkingHoursWeek({
      intervals: JSON.parse(String(form.get('intervals') ?? '')),
    });
    if (!parsed.ok) return { error: parsed.reason };
    const revision = Number(form.get('revision'));
    if (!Number.isSafeInteger(revision) || revision < 0)
      return { error: t('Обновите страницу перед сохранением.') };
    return {
      data: await beautyApi.saveLocationHours({
        expectedRevision: revision,
        intervals: parsed.value,
      }),
    };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        error instanceof ApiError
          ? error.message
          : t('Не удалось сохранить режим работы. Ввод сохранён.'),
    };
  }
}
