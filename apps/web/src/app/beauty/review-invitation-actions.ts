'use server';
import { unstable_rethrow } from 'next/navigation';
import { ApiError, authApi, beautyApi } from '../../lib/api';
import { serverT } from '../../i18n/server';

export type ReviewInvitationState = {
  error?: string;
  invitation?: { reviewPath: string; expiresAt: string; masterCount: number };
} | null;

export async function issueReviewInvitation(
  _previous: ReviewInvitationState,
  form: FormData,
): Promise<ReviewInvitationState> {
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
      return { error: t('Контекст изменён. Откройте запись в нужном филиале.') };
    return {
      invitation: await beautyApi.issueReviewInvitation(String(form.get('appointmentId') ?? '')),
    };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error: error instanceof ApiError ? error.message : t('Не удалось создать ссылку на отзыв.'),
    };
  }
}
