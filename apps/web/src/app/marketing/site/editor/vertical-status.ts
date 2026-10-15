import { verticalCopy } from '../../../../lib/vertical-copy';
import type { WebVertical } from '../../../../lib/vertical-landing';

/**
 * SITE-1: честный ответ на «Создать сайт» у направления, которое сервер ещё не подключил. Сегодня API конструктора
 * принимает только гостиницу (`marketing-site/scope.ts`: 403 без кода, «Сайт и SEO пока доступны только гостиницам»).
 * Решает сервер: экран ничего не запрещает сам, а переводит такой отказ в понятные слова. Как только API начнёт
 * принимать салон и ресторан, отказа не будет, и тот же экран создаст сайт без правок.
 *
 * Отказ лицензии и прочие отказы с кодом (`SITE_BUILDER_NOT_ENABLED` и т. п.) показываются словами сервера.
 */
export function verticalPending(vertical: WebVertical, reply: { status?: number; code?: string | null }): boolean {
  return vertical !== 'HOSPITALITY' && reply.status === 403 && !reply.code;
}

export function verticalPendingText(vertical: WebVertical): string {
  const copy = verticalCopy(vertical);
  return `Конструктор сайтов для ${copy.businessesOf} подключается. Данные филиала и выбранный дизайн уже готовы: создать сайт можно будет здесь же, как только конструктор заработает.`;
}

/** Ошибка создания словами: отказ по направлению отдельно, остальное как сказал сервер */
export function createErrorText(vertical: WebVertical, reply: { status?: number; code?: string | null; message: string }): string {
  return verticalPending(vertical, reply) ? verticalPendingText(vertical) : reply.message;
}
