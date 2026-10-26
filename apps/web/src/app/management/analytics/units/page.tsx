import { requireFeature } from '../../../../lib/vertical-guard';
import { Suspense } from 'react';
import { normalizeSearchParams, type SearchParams } from '../../../../lib/search-params';
import { hotelToday } from '../../../../lib/hotel-api';
import { Page } from '../../../../components/page';
import { Alert } from '../../../../components/ui';
import { AnalyticsTabs } from '../tabs';
import { AnalyticsToolbar } from '../toolbar';
import { parseAnalyticsQuery } from '../params';
import { UnitsReport, UnitsSkeleton } from './units';
import '../analytics.css';
import { serverT } from '../../../../i18n/server';

/**
 * «Аналитика → По номерам» (REP3, план `plans/reports-hub-2026-10-02.md` §3): занятость каждого места
 * за период — та же полоса периода и тип фонда, что у соседних вкладок, сравнения с прошлым отрезком нет.
 */
export default async function UnitsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireFeature('/management/analytics/units');
  const sp = normalizeSearchParams(await searchParams);
  const today = await hotelToday();
  const query = parseAnalyticsQuery(sp, today, 'units');
  const t = await serverT();
  return (
    <Page
      title={t('Аналитика')}
      className="analytics-page"
      subtitle={t('Сколько ночей занято и сколько заездов было у каждого места.')}
    >
      <AnalyticsTabs current="units" fund={query.fund} />
      <AnalyticsToolbar query={query} today={today} noCompare />
      {query.period.error && (
        <Alert boxed>{t('{error}. Показан сегодняшний день.', { error: t(query.period.error) })}</Alert>
      )}
      <Suspense
        key={`${query.period.from}|${query.period.to}|${query.fund}`}
        fallback={<UnitsSkeleton />}
      >
        <UnitsReport query={query} />
      </Suspense>
    </Page>
  );
}
