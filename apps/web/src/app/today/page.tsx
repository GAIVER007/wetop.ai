import { cookies } from 'next/headers';
import { unstable_rethrow } from 'next/navigation';
import { beautyTotalsVisible, deskAccessOf, mayAccess } from '../../lib/navigation';
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
import { translator } from '../../i18n';
import { currentLocale } from '../../i18n/server';

/**
 * Рабочий экран дня (MV8): один адрес на все направления. Экран выбирает подтверждённое направление
 * выбранного филиала; без него гостиница не угадывается, человек идёт через выбор филиала (SCOPE-HARDENING).
 * Гостиница: с 13.10.2026 снова своя Главная (загрузка, события дня, задачи), «Финансы» отдельно
 * (решение владельца поверх ADR-152, план объединения plans/finance-home-merge-2026-10-09.md).
 */
export default async function TodayPage({
  searchParams,
}: {
  searchParams?: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const me = await requireFeature('/today');
  // «Личный кабинет» (роль EMPLOYEE, решение владельца 20.10.2026): рабочего дня ему не видно, сразу «Моя работа»
  if (me.user && deskAccessOf(me).role === 'EMPLOYEE') redirect('/my-work');
  if (
    ownerSummaryEnabled(process.env.APP_UNIFIED_OWNER_HOME) &&
    me.user &&
    mayAccess(deskAccessOf(me), 'reports') &&
    // администратор салона без должности: рабочий день без выручки салона (запуск 25.10.2026)
    (me.context?.vertical !== 'BEAUTY' || beautyTotalsVisible(deskAccessOf(me)))
  ) {
    const c = me.context;
    const locale = await currentLocale();
    const t = translator(locale);
    if (c?.vertical && !TODAY_VERTICALS.includes(c.vertical))
      return <p>{t('Направление не поддерживается')}</p>;
    if (!c?.businessId || !c.locationId) redirect('/branches');
    const q = (await searchParams) ?? {};
    // «Свой период» (владелец 29.10.2026): календарь отправляет ?from=&to=, сервер проверяет даты сам
    const period = ownerPeriod(q.from && q.to ? `range:${q.from}..${q.to}` : q.period);
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
          <OwnerSummaryView summary={owner.summary} locale={locale} />
        </TodayScopeContent>
      );
    if (!owner.closed)
      return (
        // общий каркас `Page`: один `main#main-content`, куда ведёт «К содержимому» (Д6)
        <Page title={t('Главная')}>
          <Alert>
            {t(
              'Не удалось загрузить сводку. Данные не заменены нулями. Проверьте подключение и доступ к отчётам выбранного филиала.',
            )}
          </Alert>
          <p>
            <a className="btn" href={`/today?period=${encodeURIComponent(period)}`}>
              {t('Повторить')}
            </a>{' '}
            <a className="btn btn--secondary" href="/today/operations">
              {t('Рабочий день')}
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
