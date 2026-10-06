import { redirect } from 'next/navigation';
import { currentMe } from './desk-shell';
import { landingForVertical, type WebVertical } from './vertical-landing';
import { redirectIfScopeStale } from './scope-gate';
export async function requireVertical(allowed: WebVertical[]) {
  const me = await currentMe();
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
