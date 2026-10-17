import { redirect } from 'next/navigation';
import { ApiError } from './api-error';
import { redirectToLoginIfRequired } from './session';
import { currentMe } from './desk-shell';
import { landingForVertical, type WebVertical } from './vertical-landing';
import { redirectIfScopeStale } from './scope-gate';
import { featureVerticals } from './features';
export async function requireVertical(allowed: WebVertical[]) {
  const me = await currentMe().catch(async (error: unknown) => {
    // /auth/me is quiet in the shared API client because login pages also use it.
    // A protected vertical must route expired sessions through the existing login gate.
    if (error instanceof ApiError && error.status === 401)
      await redirectToLoginIfRequired();
    throw error;
  });
  // Устаревший указатель: сначала выбор филиала, иначе страница отрисовалась бы на ответах 403 (SCOPE-HARDENING)
  await redirectIfScopeStale(me);
  const v = me.context?.vertical;
  if (
    v &&
    ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'].includes(v) &&
    !allowed.includes(v as WebVertical)
  )
    redirect(landingForVertical(v as WebVertical));
  return me;
}

/**
 * Охрана страницы по реестру функций (У1): направления берутся из `features.ts` по адресу раздела, а не списком
 * в каждой странице. Чужое направление уходит на свою стартовую, как у `requireVertical`.
 */
export async function requireFeature(route: string) {
  return requireVertical([...featureVerticals(route)]);
}
