import { cache } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { authApi } from './api';
import { authRequired, redirectToLoginIfRequired } from './session';
import { ApiError } from './api-error';
import { UNKNOWN_SHELL, deskShellOf, type DeskShell } from './desk-person';

/**
 * Один `/auth/me` на отрисовку: меню, подпись и «Выйти» спрашивают одно и то же (бюджет рейсов —
 * `tests/ui/requests.spec.ts`). Отказ API здесь не превращается в «никто не вошёл» — это решает вызывающий.
 */
export const currentMe = cache(async () => {
  let me: Awaited<ReturnType<typeof authApi.me>>;
  try {
    me = await authApi.me();
  } catch (error) {
    // Only an invalid session requests login. Permission and network failures stay distinct.
    if (error instanceof ApiError && error.status === 401) await redirectToLoginIfRequired();
    throw error;
  }
  if (!me.user) await redirectToLoginIfRequired();
  return me;
});

/**
 * Что оболочка стойки знает о вошедшем (ADR-083, ADR-107). Макет не ждёт ответа: обещание уходит в меню, и пункты
 * появляются, когда API ответит. Отказ или нет связи — как у администратора (`UNKNOWN_SHELL`): пункт и кнопка не
 * появляются по ошибке. Управление самого Next (переход на вход, динамическая отрисовка) пропускается дальше.
 */
export async function deskShell(): Promise<DeskShell> {
  try {
    const me = await currentMe();
    const shell = deskShellOf(me);
    if (!me.user) {
      // The documented open-stand exception applies only outside production.
      return !authRequired() && process.env.NODE_ENV !== 'production'
        ? shell
        : { ...shell, access: UNKNOWN_SHELL.access };
    }
    const c = me.context;
    if (
      !c ||
      typeof c.vertical !== 'string' ||
      !['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'].includes(c.vertical) ||
      typeof c.businessId !== 'string' ||
      !c.businessId ||
      typeof c.locationId !== 'string' ||
      !c.locationId
    )
      return { ...shell, access: UNKNOWN_SHELL.access };
    return { ...shell, scopeKey: `${c.businessId}:${c.locationId}` };
  } catch (error) {
    unstable_rethrow(error);
    return UNKNOWN_SHELL;
  }
}
