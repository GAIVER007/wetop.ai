'use server';
import { ApiError, authApi, beautyApi, type BeautyAppointmentHistoryResponse } from '../../lib/api';
import { serverT } from '../../i18n/server';

export async function loadAppointmentHistory(
  id: string,
  scopeKey: string,
): Promise<{ history?: BeautyAppointmentHistoryResponse; error?: string }> {
  const t = await serverT();
  try {
    const expected = JSON.parse(scopeKey) as Record<string, unknown>;
    const me = await authApi.me();
    if (
      !expected.organizationId ||
      !expected.businessId ||
      !expected.locationId ||
      me.user?.organizationId !== expected.organizationId ||
      me.context?.businessId !== expected.businessId ||
      me.context?.locationId !== expected.locationId
    ) {
      return { error: t('Контекст изменён. Откройте запись в нужном филиале.') };
    }
    return { history: await beautyApi.appointmentHistory(id) };
  } catch (error) {
    return {
      error: error instanceof ApiError ? error.message : t('Не удалось загрузить историю записи.'),
    };
  }
}
