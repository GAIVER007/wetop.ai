import { Suspense } from 'react';
import { normalizeSearchParams, type SearchParams } from '../../../lib/search-params';
import { hotelToday } from '../../../lib/hotel-api';
import { requireVertical } from '../../../lib/vertical-guard';
import { Page } from '../../../components/page';
import { Alert } from '../../../components/ui';
import { AnalyticsToolbar } from '../../management/analytics/toolbar';
import { parseAnalyticsQuery } from '../../management/analytics/params';
import { ReportScopeFrame } from '../../management/analytics/vertical/scope-frame';
import { UnitsReport, UnitsSkeleton } from '../../management/analytics/units/units';
import { ReportsTabs } from '../reports-tabs';
import '../../management/analytics/analytics.css';
import '../../directory.css';
import '../reports.css';

/** «Отчёты → units» (RPT2.2c-1): тот же экран, что в «Аналитике», под адресом раздела «Отчёты» */
export default async function ReportsUnitsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireVertical(['HOSPITALITY']);
  const sp = normalizeSearchParams(await searchParams);
  const today = await hotelToday();
  const query = parseAnalyticsQuery(sp, today, 'units', '/reports');
  return (
    <ReportScopeFrame>
      <Page
        title="Отчёты"
        className="analytics-page"
        subtitle="Сколько ночей занято и сколько заездов было у каждого места."
      >
        <ReportsTabs current="units" fund={query.fund} />
        <AnalyticsToolbar query={query} today={today} noCompare />
        {query.period.error && <Alert boxed>{query.period.error}. Показан сегодняшний день.</Alert>}
        <Suspense
          key={`${query.period.from}|${query.period.to}|${query.fund}`}
          fallback={<UnitsSkeleton />}
        >
          <UnitsReport query={query} />
        </Suspense>
      </Page>
    </ReportScopeFrame>
  );
}
