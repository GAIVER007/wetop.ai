import { cookies } from 'next/headers';
import { unstable_rethrow } from 'next/navigation';
import { deskAccessOf, mayAccess } from '../../lib/navigation';
import { ownerPeriod, ownerSummaryEnabled } from '../../lib/owner-summary';
import { readOwnerSummary } from '../../lib/owner-summary-api';
import { OwnerSummaryView } from './unified-owner';
import { redirect } from 'next/navigation';
import { requireFeature } from '../../lib/vertical-guard';
import { SCOPE_COOKIE, scopeHeader } from '../../lib/scope-pointer';
import { authRequired } from '../../lib/session';
import { BeautyToday } from './beauty-today';
import {
  TODAY_VERTICALS,
  anonymousHospitalityAllowed,
  ownerSummaryClosed,
  todayScreen,
  unresolvedTarget,
} from './dispatch';
import { FoodToday } from './food-today';
import { HospitalityToday } from './hospitality-today';
import { TodayScopeContent } from './scope-content';
import { Page } from '../../components/page';
import { Alert } from '../../components/ui';

/**
 * Рабочий экран дня (MV8): один адрес на все направления. Экран выбирает подтверждённое направление
 * выбранного филиала; без него гостиница не угадывается, человек идёт через выбор филиала (SCOPE-HARDENING).
 * Гостиница: с 13.10.2026 снова своя Главная (загрузка, события дня, задачи), «Финансы» отдельно
 * (решение владельца поверх ADR-152, план объединения plans/finance-home-merge-2026-10-09.md).
 */
export default async function TodayPage({
  searchParams,
}: {
  searchParams?: Promise<{ period?: string }>;
}) {
  const me = await requireFeature('/today');
  if (
    ownerSummaryEnabled(process.env.APP_UNIFIED_OWNER_HOME) &&
    me.user &&
    mayAccess(deskAccessOf(me), 'reports')
  ) {
    const c = me.context;
    if (c?.vertical && !TODAY_VERTICALS.includes(c.vertical))
      return <p>Направление не поддерживается</p>;
    if (!c?.businessId || !c.locationId) redirect('/branches');
    const period = ownerPeriod((await searchParams)?.period);
    const owner = await readOwnerSummary(period).then(
      (summary) => ({ summary, closed: false as const }),
      (error: unknown) => {
        unstable_rethrow(error);
        // сводка не этого человека в этом филиале: ниже обычный рабочий день (Д6)
        if (ownerSummaryClosed(error)) return { summary: null, closed: true as const };
        return { summary: null, closed: false as const };
      },
    );
    if (owner.summary)
      return (
        <TodayScopeContent key={`${c.businessId}:${c.locationId}`}>
          <OwnerSummaryView summary={owner.summary} />
        </TodayScopeContent>
      );
    if (!owner.closed)
      return (
        // общий каркас `Page`: один `main#main-content`, куда ведёт «К содержимому» (Д6)
        <Page title="Главная">
          <Alert>
            Не удалось загрузить сводку. Данные не заменены нулями. Проверьте подключение и доступ к
            отчётам выбранного филиала.
          </Alert>
          <p>
            <a className="btn" href={`/today?period=${period}`}>
              Повторить
            </a>{' '}
            <a className="btn btn--secondary" href="/today/operations">
              Рабочий день
            </a>
          </p>
        </Page>
      );
  }
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
  // гостиница: Главная снова отдельным экраном (решение владельца 13.10.2026, «Финансы» по эталону)
  if (screen === 'HOSPITALITY')
    return (
      <TodayScopeContent key={key}>
        <HospitalityToday />
      </TodayScopeContent>
    );
  const content = screen === 'BEAUTY' ? <BeautyToday /> : <FoodToday />;
  return <TodayScopeContent key={key}>{content}</TodayScopeContent>;
}
