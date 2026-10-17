import { ApiError } from '../../lib/api-error';
import { scopeResolvePath } from '../../lib/scope-pointer';
import type { WebVertical } from '../../lib/vertical-landing';

/** `/today` один на все направления (MV8): гостиница видит «Главную», салон и ресторан свой «Сегодня» */
export const TODAY_VERTICALS: WebVertical[] = ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'];

export type TodayScreen = WebVertical | 'UNRESOLVED';

/**
 * Исключение совместимости только для открытого стенда разработки и тестов вне production: замок входа
 * выключен, сессии нет, и `/today` показывает единственную гостиницу стенда, как до MV8. В production
 * исключения нет, даже если замок выключен явно (`APP_AUTH_REQUIRED=0`).
 */
export function anonymousHospitalityAllowed(input: {
  authRequired: boolean;
  nodeEnv: string | undefined;
}): boolean {
  return !input.authRequired && input.nodeEnv !== 'production';
}

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
  opts: { allowAnonymousHospitality: boolean } = { allowAnonymousHospitality: false },
): { screen: TodayScreen; key: string } {
  const c = me.context;
  const key = `${c?.businessId ?? ''}:${c?.locationId ?? ''}`;
  if (c?.vertical === 'HOSPITALITY') return { screen: 'HOSPITALITY', key };
  if (!me.user && opts.allowAnonymousHospitality) return { screen: 'HOSPITALITY', key };
  if ((c?.vertical === 'BEAUTY' || c?.vertical === 'FOOD_SERVICE') && c.businessId && c.locationId)
    return { screen: c.vertical, key };
  return { screen: 'UNRESOLVED', key };
}

export function unresolvedTarget(hasPointer: boolean): string {
  return hasPointer ? '/branches' : scopeResolvePath('/today');
}

/**
 * Сводка руководителя закрыта этому человеку в этом филиале: веб пускает по роли, API проверяет назначения
 * филиала (`owner-summary.ts`, `canAt`). Тогда показываем рабочий день, а не экран ошибки (аудит 17.10.2026, Д6).
 */
export function ownerSummaryClosed(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}
