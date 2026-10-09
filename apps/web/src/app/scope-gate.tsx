import { unstable_rethrow } from 'next/navigation';
import { currentMe } from '../lib/desk-shell';
import { redirectIfScopeStale } from '../lib/scope-gate';

/**
 * Гейт указателя филиала (SCOPE-HARDENING): тот же `/auth/me`, что меню (кэш на отрисовку), лишнего рейса нет.
 * Отказ `/auth/me` здесь не решается: его решают страницы и шапка.
 */
export async function ScopeGate() {
  try {
    await redirectIfScopeStale(await currentMe());
  } catch (error) {
    unstable_rethrow(error);
  }
  return null;
}
