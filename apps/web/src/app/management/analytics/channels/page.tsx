import { Suspense } from 'react';
import { normalizeSearchParams, type SearchParams } from '../../../../lib/search-params';
import { hotelToday } from '../../../../lib/hotel-api';
import { Page } from '../../../../components/page';
import { Alert } from '../../../../components/ui';
import { AnalyticsTabs } from '../tabs';
import { ChannelsReport, ChannelsSkeleton } from './channels';
import { parseChannelsQuery } from './query';
import '../analytics.css';

/**
 * «Аналитика → Каналы» (ADR-141): эффективность каналов продаж: доход, ночи и средняя стоимость ночи по
 * каждому каналу за период заезда, с долями, итогом, сравнением с другим периодом и выгрузкой.
 */
export default async function ChannelsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = normalizeSearchParams(await searchParams);
  const today = await hotelToday();
  const query = parseChannelsQuery(sp, today);
  return (
    <Page
      title="Аналитика"
      className="analytics-page"
      subtitle="Какой канал приносит больше дохода и ночей, и по какой средней цене."
    >
      <AnalyticsTabs current="channels" />
      {query.error && <Alert boxed>{query.error}. Показан текущий месяц.</Alert>}
      <Suspense
        key={[query.from, query.to, query.compare, query.compareFrom, query.compareTo, query.channel, query.sort, query.empty].join('|')}
        fallback={<ChannelsSkeleton />}
      >
        <ChannelsReport query={query} />
      </Suspense>
    </Page>
  );
}
