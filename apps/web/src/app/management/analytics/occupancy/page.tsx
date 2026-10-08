import { requireVertical } from '../../../../lib/vertical-guard';
import { Suspense } from 'react';
import { normalizeSearchParams, type SearchParams } from '../../../../lib/search-params';
import { hotelToday } from '../../../../lib/hotel-api';
import { Page } from '../../../../components/page';
import { Alert } from '../../../../components/ui';
import { AnalyticsTabs } from '../tabs';
import { AnalyticsToolbar } from '../toolbar';
import { parseAnalyticsQuery } from '../params';
import { Occupancy, OccupancySkeleton } from './occupancy';
import '../analytics.css';

/**
 * «Аналитика → Загрузка» v2 (ТЗ владельца «Аналитика v2», срез AN2, ADR-114): бывшая «Статистика» в системе
 * модуля — та же полоса периода, что у «Обзора», по умолчанию сегодняшний день. Старые адреса
 * `/management/statistics?date=` и `?date=` этой вкладки работают; `data-testid` таблицы, подписи, сбоя и
 * ожидания прежние — на них стоят сверки и обход стойки.
 */
export default async function OccupancyPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireVertical(['HOSPITALITY']);
  const sp = normalizeSearchParams(await searchParams);
  const today = await hotelToday();
  const query = parseAnalyticsQuery(sp, today, 'occupancy');
  return (
    <Page
      title="Аналитика"
      className="analytics-page"
      subtitle="Сколько мест занято, свободно и закрыто — за день или период."
    >
      <AnalyticsTabs current="occupancy" fund={query.fund} />
      <AnalyticsToolbar query={query} today={today} />
      {query.period.error && <Alert boxed>{query.period.error}. Показан сегодняшний день.</Alert>}
      <Suspense
        key={`${query.period.from}|${query.period.to}|${query.fund}|${query.compare}`}
        fallback={<OccupancySkeleton />}
      >
        <Occupancy query={query} />
      </Suspense>
    </Page>
  );
}
