'use server';
import { unstable_rethrow } from 'next/navigation';
import { ApiError } from '../../../lib/api-error';
import { reviewApi } from './review-api';
import type { BeautyReviewDraft } from './review-types';
import { msg } from '../../../i18n';

/** Текст ошибки по-русски, форма переводит его при показе */
export type SubmitBeautyReviewState = { error?: string; submitted?: boolean } | null;

export async function submitBeautyReview(
  token: string,
  reviews: BeautyReviewDraft[],
): Promise<SubmitBeautyReviewState> {
  const normalized = reviews.map((review) => ({
    masterKey: review.masterKey,
    stars: review.stars,
    ...(review.comment?.trim() ? { comment: review.comment.trim() } : {}),
  }));
  if (!token || normalized.length < 1)
    return { error: msg('Выберите хотя бы одного мастера и поставьте оценку.') };
  if (
    new Set(normalized.map((review) => review.masterKey)).size !== normalized.length ||
    normalized.some((review) => !review.masterKey || !Number.isInteger(review.stars) || review.stars < 1 || review.stars > 5)
  )
    return { error: msg('Проверьте выбранных мастеров и оценки.') };
  try {
    await reviewApi.submit(token, { reviews: normalized });
    return { submitted: true };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError && error.status === 409)
      return { error: msg('Отзыв по этой ссылке уже отправлен.') };
    if (error instanceof ApiError && error.status === 404)
      return { error: msg('Ссылка на отзыв недействительна или срок её действия истёк.') };
    if (error instanceof ApiError && error.status === 400) return { error: error.message };
    return { error: msg('Не удалось отправить отзыв. Проверьте подключение и повторите.') };
  }
}
