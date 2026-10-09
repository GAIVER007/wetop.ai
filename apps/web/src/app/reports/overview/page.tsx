import { Suspense } from 'react';
import { normalizeSearchParams, type SearchParams } from '../../../lib/search-params';
import { hotelToday } from '../../../lib/hotel-api';
import { requireVertical } from '../../../lib/vertical-guard';
import { Page } from '../../../components/page';
import { Alert } from '../../../components/ui';
import { AnalyticsToolbar } from '../../management/analytics/toolbar';
import { parseAnalyticsQuery } from '../../management/analytics/params';
import { ReportScopeFrame } from '../../management/analytics/vertical/scope-frame';
import { Overview, OverviewSkeleton } from '../../management/analytics/overview';
import { ReportsTabs } from '../reports-tabs';
import '../../management/analytics/analytics.css';
import '../../directory.css';
import '../reports.css';

/** «Отчёты → overview» (RPT2.2c-1): тот же экран, что в «Аналитике», под адресом раздела «Отчёты» */
export default async function ReportsOverviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireVertical(['HOSPITALITY']);
  const sp = normalizeSearchParams(await searchParams);
  const today = await hotelToday();
  const query = parseAnalyticsQuery(sp, today, 'overview', '/reports');
  return (
    <ReportScopeFrame>
      <Page
        title="Отчёты"
        className="analytics-page"
        subtitle="Как работал объект за период и что изменилось."
      >
        <ReportsTabs current="overview" fund={query.fund} />
        <AnalyticsToolbar query={query} today={today} />
        {query.period.error && <Alert boxed>{query.period.error}. Показан сегодняшний день.</Alert>}
        <Suspense
          key={`${query.period.from}|${query.period.to}|${query.fund}|${query.compare}`}
          fallback={<OverviewSkeleton />}
        >
          <Overview query={query} today={today} />
        </Suspense>
      </Page>
    </ReportScopeFrame>
  );
}
