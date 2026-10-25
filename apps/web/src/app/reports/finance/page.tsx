import { Suspense } from 'react';
import { normalizeSearchParams, type SearchParams } from '../../../lib/search-params';
import { hotelToday } from '../../../lib/hotel-api';
import { requireFeature } from '../../../lib/vertical-guard';
import { Page } from '../../../components/page';
import { Alert } from '../../../components/ui';
import { AnalyticsToolbar } from '../../management/analytics/toolbar';
import { parseAnalyticsQuery } from '../../management/analytics/params';
import { ReportScopeFrame } from '../../management/analytics/vertical/scope-frame';
import { ReportsTabs } from '../reports-tabs';
import { CashFlowReport, CashFlowSkeleton } from './cashflow';
import '../../management/analytics/analytics.css';
import '../../directory.css';
import '../reports.css';
import { serverT } from '../../../i18n/server';

/** «Отчёты → Финансы» (RPT2.4a): деньги за период по дням, `docs/metrics.md` §2 */
export default async function ReportsFinancePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireFeature('/reports/finance');
  const t = await serverT();
  const sp = normalizeSearchParams(await searchParams);
  const today = await hotelToday();
  const query = parseAnalyticsQuery(sp, today, 'finance', '/reports');
  return (
    <ReportScopeFrame>
      <Page
        title={t('Отчёты')}
        className="analytics-page"
        subtitle={t('Сколько денег поступило, вернулось и ушло за период.')}
      >
        <ReportsTabs current="finance" />
        <AnalyticsToolbar query={query} today={today} noCompare noFund />
        {query.period.error && <Alert boxed>{t('{error}. Показан сегодняшний день.', { error: t(query.period.error) })}</Alert>}
        <Suspense key={`${query.period.from}|${query.period.to}`} fallback={<CashFlowSkeleton />}>
          <CashFlowReport query={query} />
        </Suspense>
      </Page>
    </ReportScopeFrame>
  );
}
