import type { WebVertical } from '../../lib/vertical-landing';

/** `/today` один на все направления (MV8): гостиница видит «Главную», салон и ресторан свой «Сегодня» */
export const TODAY_VERTICALS: WebVertical[] = ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'];

/**
 * Какой экран рисовать. Решает только подтверждённый сервером контекст `/auth/me`; ключ по Business и филиалу
 * не даёт React переиспользовать экран прежнего выбора при переключении филиала.
 */
export function todayScreen(me: {
  context?: {
    vertical?: string | null;
    businessId?: string | null;
    locationId?: string | null;
  } | null;
}): { screen: WebVertical; key: string } {
  const c = me.context;
  const key = `${c?.businessId ?? ''}:${c?.locationId ?? ''}`;
  if (c?.vertical === 'BEAUTY' || c?.vertical === 'FOOD_SERVICE')
    return { screen: c.vertical, key };
  return { screen: 'HOSPITALITY', key };
}
