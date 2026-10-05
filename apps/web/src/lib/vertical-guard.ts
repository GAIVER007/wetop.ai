import { redirect } from 'next/navigation';
import { currentMe } from './desk-shell';
import { landingForVertical, type WebVertical } from './vertical-landing';
export async function requireVertical(allowed: WebVertical[]) {
  const me = await currentMe();
  const v = me.context?.vertical;
  if (
    v &&
    ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'].includes(v) &&
    !allowed.includes(v as WebVertical)
  )
    redirect(landingForVertical(v as WebVertical));
  return me;
}
