import { Suspense } from 'react';
import { resolvePeriod } from '@pms/domain';
import { hotelToday } from '../../../lib/hotel-api';
import { navigationItems } from '../../../lib/navigation';
import { normalizeSearchParams, type SearchParams } from '../../../lib/search-params';
import { Page } from '../../../components/page';
import { Alert } from '../../../components/ui';
import { PeriodBar } from '../period/period-bar';
import { DashboardSection, DashboardSkeleton } from '../period/dashboard-section';
import { notFound, redirect } from 'next/navigation';

/**
 * Хаба «Управление» нет с 15.09.2026. «Статистика» стала вкладкой «Загрузка» модуля «Аналитика»
 * (ADR-114): старые адреса и закладки ведут туда с той же датой. «Показатели за период» — блок,
 * переехавший с Главной в A1 (ADR-105); по плану AN1 это временный экран до «Аналитики», поэтому
 * адрес живёт, а в боковом меню его нет — там «Аналитика».
 */
export default async function ManagementPage({
  params,
  searchParams,
}: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<SearchParams>;
}) {
  const { section = [] } = await params;
  if (!section.length) redirect('/management/analytics');
  const sp = normalizeSearchParams(await searchParams);
  if (section.length === 1 && section[0] === 'statistics') {
    const { date } = sp;
    redirect(`/management/analytics/occupancy${date ? `?${new URLSearchParams({ date })}` : ''}`);
  }
  if (section.length === 1 && section[0] === 'dashboard') {
    const item = navigationItems.find((item) => item.href === '/management/dashboard');
    if (!item) notFound();
    return (
      <Page title={item.label}>
        <PeriodDashboard period={sp.period} from={sp.from} to={sp.to} date={sp.date} />
      </Page>
    );
  }
  notFound();
}

/**
 * Показатели за период — блок, до A1 (ADR-105) стоявший на Главной: те же компоненты, тот же
 * `GET /desk/dashboard`, определения ADR-047 не менялись. Ожидание и отказ — как было на Главной:
 * полоса периода открывается сразу, числа приходят своим куском (`Suspense`).
 */
async function PeriodDashboard(sp: {
  period?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  date?: string | undefined;
}) {
  const today = await hotelToday();
  const period = resolvePeriod({ preset: sp.period, from: sp.from, to: sp.to, date: sp.date }, today);
  return (
    <>
      <PeriodBar period={period} today={today} />
      {period.error && <Alert boxed>{period.error}. Показан сегодняшний день.</Alert>}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardSection period={period} today={today} />
      </Suspense>
    </>
  );
}
