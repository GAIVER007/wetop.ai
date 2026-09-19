import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import { resolvePeriod } from '@pms/domain';
import { ApiError, chessboardApi, dashboardApi, deskApi } from '../../lib/api';
import { hotelApi, hotelToday, validDate } from '../../lib/hotel-api';
import { Page } from '../../components/page';
import { Alert } from '../../components/ui';
import Link from 'next/link';
import { Icon } from '../../components/icon';
import { AttentionSummary, DayAttention } from './day-attention';
import { QuickActions, HotelClock } from './dashboard-widgets';
import { PeriodBar } from './period-bar';
import { KpiGrid } from './kpi';
import { CategoriesPanel, OccupancyChart, PaymentsPanel, SourcesPanel } from './dashboard-panels';
import { DeskStrip } from './desk-strip';

/**
 * Главная собственника и управляющего (срез 14, plans/slice-14-dashboard-2026-09-16.md):
 * показатели за период из шахматки и счетов, ниже — что происходит на стойке сегодня.
 * Ничего не оценивается и не прогнозируется: сравнение — только с предыдущим отрезком той же длины.
 */
export default async function TodayPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = normalizeSearchParams(await searchParams);
  const today = hotelToday();
  const period = resolvePeriod(
    { preset: sp.period, from: sp.from, to: sp.to, date: sp.date },
    today,
  );
  // Полоса стойки: явная ?date=, иначе выбранный день, иначе сегодня объекта
  const deskDate =
    sp.date && validDate(sp.date) ? sp.date : period.from === period.to ? period.from : today;
  const [hotel, dashboard, day, board] = await Promise.all([
    hotelApi.settings().catch((error: unknown) => {
      if (error instanceof ApiError) return null;
      throw error;
    }),
    dashboardApi.period(period.from, period.to),
    deskApi.today(deskDate),
    chessboardApi.board(deskDate, deskDate).catch(() => null),
  ]);
  return (
    <Page
      title="Главная"
      crumbs={<span className="eyebrow">{hotel?.property.name ?? 'Гостиница'}</span>}
      subtitle="Загрузка, деньги и задачи вашего объекта."
      actions={
        <>
          <Link href="/chessboard" className="btn btn--secondary">
            Шахматка
          </Link>
          <Link href="/reservations/new" className="btn">
            <Icon name="plus" />
            Новая бронь
          </Link>
        </>
      }
    >
      <div className="dashboard-day">
        <AttentionSummary day={day} date={deskDate} />
        <HotelClock timezone={hotel?.property.timezone ?? 'Asia/Almaty'} />
      </div>
      <PeriodBar period={period} today={today} />
      {period.error && <Alert boxed>{period.error}. Показан сегодняшний день.</Alert>}
      <KpiGrid current={dashboard.current} previous={dashboard.previous} />
      <div className="dash-grid dash-grid--chart">
        <OccupancyChart period={dashboard.current} today={today} />
        <SourcesPanel period={dashboard.current} />
      </div>
      <div className="dash-grid dash-grid--tables">
        <CategoriesPanel period={dashboard.current} />
        <PaymentsPanel period={dashboard.current} />
      </div>
      <DeskStrip day={day} board={board} today={today} />
      <div className="dash-grid dash-grid--desk">
        <QuickActions day={day} />
        <aside aria-label="Задачи и размещение">
          <DayAttention day={day} />
        </aside>
      </div>
    </Page>
  );
}
