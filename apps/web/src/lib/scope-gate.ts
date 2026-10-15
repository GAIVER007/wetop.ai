import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { safeReturnPath } from './auth-entry';
import { SCOPE_COOKIE, scopeResolvePath } from './scope-pointer';
import { scopeIsStale } from './scope-resolve';

/**
 * Устаревший указатель филиала (архивный или удалённый филиал, чужая организация после смены входа): API на нём
 * отвечает 403 и fail-closed остаётся (MV1). Стойка не показывает экран с ошибками, а сбрасывает выбор через
 * `/scope/resolve`, вернув человека на ту же страницу, если она подходит выбранному направлению.
 */
export async function redirectIfScopeStale(me: {
  user: unknown;
  context?: { businessId?: string | null } | null;
}): Promise<void> {
  const cookie = (await cookies()).get(SCOPE_COOKIE)?.value;
  if (!scopeIsStale(cookie, me)) return;
  const back = (await headers()).get('x-wetop-return');
  redirect(scopeResolvePath(safeReturnPath(back)));
}
