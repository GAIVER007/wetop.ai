'use server';
import { unstable_rethrow } from 'next/navigation';
import { orderRatingApi } from '../../../lib/api';
import { ApiError } from '../../../lib/api-error';
import { clientInfo } from '../../../lib/session';
import { msg } from '../../../i18n';

/** Оценка гостя по ссылке (§40): ответ словами, без подробностей о заказе; текст ошибки переводит форма при показе */
export async function submitRating(
  token: string,
  stars: number,
  comment: string,
): Promise<{ error: string | null }> {
  try {
    await orderRatingApi.rate(token, { stars, comment: comment.trim() || null }, await clientInfo());
    return { error: null };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError && [400, 404, 429].includes(error.status)) return { error: error.message };
    return { error: msg('Не удалось отправить оценку. Проверьте подключение и повторите.') };
  }
}
