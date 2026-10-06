import { cache } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { authApi } from './api';
import { verifiedTodayScope } from './today-loaders';
import { CLOSED_SHELL, UNKNOWN_SHELL, deskShellOf, type DeskShell } from './desk-person';

/**
 * Один `/auth/me` на отрисовку: меню, подпись и «Выйти» спрашивают одно и то же (бюджет рейсов —
 * `tests/ui/requests.spec.ts`). Отказ API здесь не превращается в «никто не вошёл» — это решает вызывающий.
 */
export const currentMe = cache(() => authApi.me());

/**
 * Что оболочка стойки знает о вошедшем (ADR-083, ADR-107). Макет не ждёт ответа: обещание уходит в меню, и пункты
 * появляются, когда API ответит. Отказ или нет связи — как у администратора (`UNKNOWN_SHELL`): пункт и кнопка не
 * появляются по ошибке. Управление самого Next (переход на вход, динамическая отрисовка) пропускается дальше.
 */
export async function deskShell(): Promise<DeskShell> {
  try {
    const me = await currentMe();
    if (!me?.user) return { ...CLOSED_SHELL, access: { ...CLOSED_SHELL.access, unknown: true } };
    let scope: ReturnType<typeof verifiedTodayScope>;
    try {
      scope = verifiedTodayScope(me);
    } catch {
      return { ...UNKNOWN_SHELL, person: deskShellOf(me).person };
    }
    return {
      ...deskShellOf(me),
      scopeKey: `${scope.businessId}:${scope.locationId}`,
    };
  } catch (error) {
    unstable_rethrow(error);
    return UNKNOWN_SHELL;
  }
}
