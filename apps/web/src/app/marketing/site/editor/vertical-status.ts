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
 * Куда ведёт «Опубликовать». С ADR-185/SITE-3 API публикует сайт любого направления, формы записи салона и брони стола
 * работают (SITE-4/5), поэтому «Опубликовать» у всех трёх ведёт на страницу публикации (аудит «Сайт и SEO» 28.10.2026;
 * прежний запрет Д10 от 17.10.2026 снят).
 */
export function publishTarget(vertical: WebVertical): { href: '/marketing/site' } | { reason: string } {
  void vertical;
  return { href: '/marketing/site' };
}

/**
 * Брони на сайте по направлению: виджет брони номеров (`WETOP_WIDGET`) считает цены по объекту гостиницы, у салона и
 * ресторана объекта нет (API ответил бы 409 `NO_PROPERTY`). Их запись и бронь стола идут формой в блоке страницы.
 */
export function bookingModes(vertical: WebVertical): Array<'WETOP_WIDGET' | 'NONE'> {
  return vertical === 'HOSPITALITY' ? ['WETOP_WIDGET', 'NONE'] : ['NONE'];
}
