'use server';
import { unstable_rethrow } from 'next/navigation';
import { ApiError, reservationsApi } from '../../../lib/api';
import { serverT } from '../../../i18n/server';

export type StayReviewState = { error?: string; reviewPath?: string; expiresAt?: string } | null;

/** Ссылка на отзыв гостю после выезда (HOTEL-REVIEWS-20261031): новая заменяет прежнюю */
export async function issueStayReviewAction(_prev: StayReviewState, form: FormData): Promise<StayReviewState> {
  const t = await serverT();
  try {
    return await reservationsApi.issueStayReview(String(form.get('number') ?? ''));
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof ApiError ? error.message : t('Не удалось создать ссылку на отзыв.') };
  }
}
