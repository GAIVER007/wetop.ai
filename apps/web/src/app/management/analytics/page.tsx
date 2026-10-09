import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireVertical } from '../../../lib/vertical-guard';
import { SCOPE_COOKIE, scopeHeader } from '../../../lib/scope-pointer';
import { authRequired } from '../../../lib/session';
import { normalizeSearchParams, type SearchParams } from '../../../lib/search-params';
import {
  TODAY_VERTICALS,
  anonymousHospitalityAllowed,
  todayScreen,
  unresolvedTarget,
} from '../../today/dispatch';
import { HospitalityAnalytics } from './hospitality-page';
import { ReportScopeFrame } from './vertical/scope-frame';
import { VerticalAnalytics } from './vertical/screen';
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const me = await requireVertical(TODAY_VERTICALS);
  const { screen, key } = todayScreen(me, {
    allowAnonymousHospitality: anonymousHospitalityAllowed({
      authRequired: authRequired(),
      nodeEnv: process.env.NODE_ENV,
    }),
  });
  if (screen === 'UNRESOLVED')
    redirect(
      unresolvedTarget(
        Boolean(scopeHeader((await cookies()).get(SCOPE_COOKIE)?.value)['x-wetop-scope']),
      ),
    );
  const sp = normalizeSearchParams(await searchParams);
  if (screen === 'HOSPITALITY' && sp.scope !== 'organization')
    return (
      <ReportScopeFrame key={key}>
        <HospitalityAnalytics searchParams={searchParams} />
      </ReportScopeFrame>
    );
  return (
    <ReportScopeFrame key={key}>
      <VerticalAnalytics sp={sp} />
    </ReportScopeFrame>
  );
}
