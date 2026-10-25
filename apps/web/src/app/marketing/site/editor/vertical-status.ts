import type { WebVertical } from '../../../../lib/vertical-landing';
import { msg, type Translate } from '../../../../i18n';

const same: Translate = (text) => text;

const PENDING: Record<WebVertical, string> = {
  HOSPITALITY: msg(
    'Конструктор сайтов для гостиниц подключается. Данные филиала и выбранный дизайн уже готовы: создать сайт можно будет здесь же, как только конструктор заработает.',
  ),
  BEAUTY: msg(
    'Конструктор сайтов для салонов подключается. Данные филиала и выбранный дизайн уже готовы: создать сайт можно будет здесь же, как только конструктор заработает.',
  ),
  FOOD_SERVICE: msg(
    'Конструктор сайтов для ресторанов подключается. Данные филиала и выбранный дизайн уже готовы: создать сайт можно будет здесь же, как только конструктор заработает.',
  ),
};

const PUBLISH_LATER: Record<Exclude<WebVertical, 'HOSPITALITY'>, string> = {
  BEAUTY: msg('Публикация сайта салонов появится вместе с онлайн-записью на сайте. Черновик и изображения сохраняются уже сейчас.'),
  FOOD_SERVICE: msg(
    'Публикация сайта ресторанов появится вместе с онлайн-записью на сайте. Черновик и изображения сохраняются уже сейчас.',
  ),
};

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

export function verticalPendingText(vertical: WebVertical, t: Translate = same): string {
  return t(PENDING[vertical]);
}

/** Ошибка создания словами: отказ по направлению отдельно, остальное как сказал сервер */
export function createErrorText(
  vertical: WebVertical,
  reply: { status?: number; code?: string | null; message: string },
  t: Translate = same,
): string {
  return verticalPending(vertical, reply) ? verticalPendingText(vertical, t) : reply.message;
}

/**
 * Куда ведёт «Опубликовать» (аудит платформы 17.10.2026, Д10). Страница публикации пока гостиничная: источник брони
 * сайта у неё тариф гостиницы. Салону и ресторану нужна своя онлайн-запись и бронь стола от их владельца; до неё кнопка
 * честно неактивна с причиной, а не уводит на «Главную».
 */
export function publishTarget(vertical: WebVertical, t: Translate = same): { href: '/marketing/site' } | { reason: string } {
  if (vertical === 'HOSPITALITY') return { href: '/marketing/site' };
  return { reason: t(PUBLISH_LATER[vertical]) };
}
