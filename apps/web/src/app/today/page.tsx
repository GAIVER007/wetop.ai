import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireVertical } from '../../lib/vertical-guard';
import { SCOPE_COOKIE, scopeHeader } from '../../lib/scope-pointer';
import { authRequired } from '../../lib/session';
import { BeautyToday } from './beauty-today';
import {
  TODAY_VERTICALS,
  anonymousHospitalityAllowed,
  todayScreen,
  unresolvedTarget,
} from './dispatch';
import { FoodToday } from './food-today';
import { TodayScopeContent } from './scope-content';

/**
 * Рабочий экран дня (MV8): один адрес на все направления. Экран выбирает подтверждённое направление
 * выбранного филиала; без него гостиница не угадывается, человек идёт через выбор филиала (SCOPE-HARDENING).
 * Гостиница с 09.10.2026 живёт одним разделом «Финансы» (план plans/finance-home-merge-2026-10-09.md):
 * прежняя Главная объединена с кассой, старые закладки `/today` переезжают туда перенаправлением.
 */
export default async function TodayPage() {
  const me = await requireVertical(TODAY_VERTICALS);
  const { screen, key } = todayScreen(me, {
    allowAnonymousHospitality: anonymousHospitalityAllowed({
      authRequired: authRequired(),
      nodeEnv: process.env.NODE_ENV,
    }),
  });
  if (screen === 'UNRESOLVED') {
    const pointer = (await cookies()).get(SCOPE_COOKIE)?.value;
    redirect(unresolvedTarget(Boolean(scopeHeader(pointer)['x-wetop-scope'])));
  }
  if (screen === 'HOSPITALITY') redirect('/finance');
  const content = screen === 'BEAUTY' ? <BeautyToday /> : <FoodToday />;
  return <TodayScopeContent key={key}>{content}</TodayScopeContent>;
}
