import Link from 'next/link';
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
import { serverT } from '../../../i18n/server';

/**
 * «Аналитика → Обзор» (ТЗ владельца «Аналитика v2» от 27.09.2026, срез AN1, ADR-114): как работал объект
 * за период , загрузка, выручка, брони, отмены, категории, источники , и стало ли лучше. Полоса периода
 * открывается сразу, числа приходят своим куском (`Suspense`), как было на Главной (ADR-047, ADR-105).
 */
export async function HospitalityAnalytics({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = normalizeSearchParams(await searchParams);
  const today = await hotelToday();
  const query = parseAnalyticsQuery(sp, today);
  const t = await serverT();
  return (
    <Page
      actions={
        <>
          <Link className="btn btn--secondary" href="/management/analytics?scope=organization">
            {t('Сводка направлений')}
          </Link>
          <Link className="btn btn--secondary" href="/branches">
            {t('Все филиалы')}
          </Link>
        </>
      }
      className="analytics-page"
      title={t('Аналитика')}
      subtitle={t('Как работал объект за период и что изменилось.')}
    >
      <AnalyticsTabs current="overview" fund={query.fund} />
      <AnalyticsToolbar query={query} today={today} monthOnly />
      {query.period.error && (
        <Alert boxed>{t('{error}. Показан сегодняшний день.', { error: t(query.period.error) })}</Alert>
      )}
      <Suspense
        key={`${query.period.from}|${query.period.to}|${query.fund}|${query.compare}`}
        fallback={<OverviewSkeleton />}
      >
        <Overview query={query} today={today} />
      </Suspense>
    </Page>
  );
}
