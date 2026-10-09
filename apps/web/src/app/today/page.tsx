import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireVertical } from '../../lib/vertical-guard';
import { SCOPE_COOKIE, scopeHeader } from '../../lib/scope-pointer';
import { authRequired } from '../../lib/session';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import { BeautyToday } from './beauty-today';
import {
  TODAY_VERTICALS,
  anonymousHospitalityAllowed,
  todayScreen,
  unresolvedTarget,
} from './dispatch';
import { FoodToday } from './food-today';
import { TodayScopeContent } from './scope-content';
import { HospitalityToday } from './hospitality-today';
import './desk.css';

/**
 * Рабочий экран дня (MV8): один адрес на все направления. Экран выбирает подтверждённое направление
 * выбранного филиала; без него гостиница не угадывается, человек идёт через выбор филиала (SCOPE-HARDENING).
 */
export default async function TodayPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
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
  const content =
    screen === 'BEAUTY' ? (
      <BeautyToday />
    ) : screen === 'FOOD_SERVICE' ? (
      <FoodToday />
    ) : (
      <HospitalityToday sp={normalizeSearchParams(await searchParams)} />
    );
  return <TodayScopeContent key={key}>{content}</TodayScopeContent>;
}
