import { Suspense } from 'react';
import { normalizeSearchParams, type SearchParams } from '../../../lib/search-params';
import { hotelToday } from '../../../lib/hotel-api';
import { Page } from '../../../components/page';
import { Alert } from '../../../components/ui';
import { AnalyticsTabs } from './tabs';
import { AnalyticsToolbar } from './toolbar';
import { Overview, OverviewSkeleton } from './overview';
import { parseAnalyticsQuery } from './params';
import './analytics.css';

/**
 * «Аналитика → Обзор» (ТЗ владельца «Аналитика v2» от 27.09.2026, срез AN1, ADR-114): как работал объект
 * за период — загрузка, выручка, брони, отмены, категории, источники — и стало ли лучше. Полоса периода
 * открывается сразу, числа приходят своим куском (`Suspense`), как было на Главной (ADR-047, ADR-105).
 */
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = normalizeSearchParams(await searchParams);
  const today = await hotelToday();
  const query = parseAnalyticsQuery(sp, today);
  return (
    <Page title="Аналитика" subtitle="Как работал объект за период и что изменилось.">
      <AnalyticsTabs current="overview" fund={query.fund} />
      <AnalyticsToolbar query={query} today={today} />
      {query.period.error && <Alert boxed>{query.period.error}. Показан сегодняшний день.</Alert>}
      <Suspense
        key={`${query.period.from}|${query.period.to}|${query.fund}|${query.compare}`}
        fallback={<OverviewSkeleton />}
      >
        <Overview query={query} today={today} />
      </Suspense>
    </Page>
  );
}
