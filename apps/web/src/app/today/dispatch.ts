import { scopeResolvePath } from '../../lib/scope-pointer';
import type { WebVertical } from '../../lib/vertical-landing';

/** `/today` один на все направления (MV8): гостиница видит «Главную», салон и ресторан свой «Сегодня» */
export const TODAY_VERTICALS: WebVertical[] = ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'];

export type TodayScreen = WebVertical | 'UNRESOLVED';

/**
 * Какой экран рисовать. Решает только подтверждённый сервером контекст `/auth/me`; ничего не угадывается
 * (SCOPE-HARDENING): нет направления, оно незнакомо, у салона или ресторана нет Business и филиала, значит
 * `UNRESOLVED`, и человек идёт через выбор филиала. Ключ по Business и филиалу не даёт React переиспользовать
 * экран прежнего выбора.
 */
export function todayScreen(
  me: {
    user?: unknown;
    context?: {
      vertical?: string | null;
      businessId?: string | null;
      locationId?: string | null;
    } | null;
  },
  lock: { authRequired: boolean } = { authRequired: true },
): { screen: TodayScreen; key: string } {
  const c = me.context;
  const key = `${c?.businessId ?? ''}:${c?.locationId ?? ''}`;
  if (c?.vertical === 'HOSPITALITY') return { screen: 'HOSPITALITY', key };
  // Открытый стенд разработки: замок входа выключен (в production-образе он включён всегда), сессии нет, филиалов
  // и выбора нет вовсе, стойка обслуживает одну гостиницу стенда, как до MV8. Вошедший сюда не попадает.
  if (!me.user && !lock.authRequired) return { screen: 'HOSPITALITY', key };
  if ((c?.vertical === 'BEAUTY' || c?.vertical === 'FOOD_SERVICE') && c.businessId && c.locationId)
    return { screen: c.vertical, key };
  return { screen: 'UNRESOLVED', key };
}

/**
 * Куда вести, если направление не подтверждено. Указателя нет: тот же выбор, что после входа (`/scope/resolve`,
 * второго выбора нет). Указатель уже стоит: автоматический выбор дал бы то же самое, поэтому человек выбирает
 * филиал сам на `/branches`.
 */
export function unresolvedTarget(hasPointer: boolean): string {
  return hasPointer ? '/branches' : scopeResolvePath('/today');
}
