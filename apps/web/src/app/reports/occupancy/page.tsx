import { Suspense } from 'react';
import { normalizeSearchParams, type SearchParams } from '../../../lib/search-params';
import { hotelToday } from '../../../lib/hotel-api';
import { requireFeature } from '../../../lib/vertical-guard';
import { Page } from '../../../components/page';
import { Alert } from '../../../components/ui';
import { AnalyticsToolbar } from '../../management/analytics/toolbar';
import { parseAnalyticsQuery } from '../../management/analytics/params';
import { ReportScopeFrame } from '../../management/analytics/vertical/scope-frame';
import { Occupancy, OccupancySkeleton } from '../../management/analytics/occupancy/occupancy';
import { ReportsTabs } from '../reports-tabs';
import '../../management/analytics/analytics.css';
import '../../directory.css';
import '../reports.css';
import { serverT } from '../../../i18n/server';

/** «Отчёты → occupancy» (RPT2.2c-1): тот же экран, что в «Аналитике», под адресом раздела «Отчёты» */
export default async function ReportsOccupancyPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireFeature('/reports/occupancy');
  const t = await serverT();
  const sp = normalizeSearchParams(await searchParams);
  const today = await hotelToday();
  const query = parseAnalyticsQuery(sp, today, 'occupancy', '/reports');
  return (
    <ReportScopeFrame>
      <Page
        title={t('Отчёты')}
        className="analytics-page"
        subtitle={t('Сколько мест занято, свободно и закрыто за день или период.')}
      >
        <ReportsTabs current="occupancy" fund={query.fund} />
        <AnalyticsToolbar query={query} today={today} />
        {query.period.error && <Alert boxed>{t('{error}. Показан сегодняшний день.', { error: t(query.period.error) })}</Alert>}
        <Suspense
          key={`${query.period.from}|${query.period.to}|${query.fund}|${query.compare}`}
          fallback={<OccupancySkeleton />}
        >
          <Occupancy query={query} />
        </Suspense>
      </Page>
    </ReportScopeFrame>
  );
}
