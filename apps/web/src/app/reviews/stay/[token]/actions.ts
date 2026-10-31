'use server';
import { unstable_rethrow } from 'next/navigation';
import { ApiError } from '../../../../lib/api-error';
import { msg } from '../../../../i18n';
import { stayReviewApi } from './stay-review-api';

export type SubmitStayReviewState = { error?: string; submitted?: boolean } | null;

export async function submitStayReview(token: string, stars: number, comment: string): Promise<SubmitStayReviewState> {
  if (!token || !Number.isInteger(stars) || stars < 1 || stars > 5) return { error: msg('Поставьте оценку от 1 до 5.') };
  try {
    await stayReviewApi.submit(token, { stars, ...(comment.trim() ? { comment: comment.trim() } : {}) });
    return { submitted: true };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError && error.status === 409) return { error: msg('Отзыв по этой ссылке уже отправлен.') };
    if (error instanceof ApiError && error.status === 404) return { error: msg('Ссылка на отзыв недействительна или срок её действия истёк.') };
    if (error instanceof ApiError && error.status === 400) return { error: error.message };
    return { error: msg('Не удалось отправить отзыв. Проверьте подключение и повторите.') };
  }
}
