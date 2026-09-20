import { Suspense } from 'react';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import { resolvePeriod } from '@pms/domain';
import { ApiError } from '../../lib/api';
import { hotelApi, hotelToday, validDate } from '../../lib/hotel-api';
import { Page } from '../../components/page';
import { Alert } from '../../components/ui';
import Link from 'next/link';
import { Icon } from '../../components/icon';
import { HotelClock } from './dashboard-widgets';
import { PeriodBar } from './period-bar';
import { DashboardSection, DashboardSkeleton } from './dashboard-section';
import { AttentionSummarySection, DeskSection, DeskSkeleton } from './desk-section';

/**
 * Главная собственника и управляющего (срез 14, plans/slice-14-dashboard-2026-09-16.md):
 * показатели за период из шахматки и счетов, ниже — что происходит на стойке сегодня.
 * Ничего не оценивается и не прогнозируется: сравнение — только с предыдущим отрезком той же длины.
 *
 * Экран открывается сразу: заголовок и выбор периода не ждут данных, а каждый блок приходит своим
 * куском (`Suspense`). Раньше страница ждала все четыре вызова разом и при отказе любого не
 * открывалась вовсе — замечание владельца 16.09.2026 «выбираю период и нифига не открывает».
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
  const hotel = await hotelApi.settings().catch((error: unknown) => {
    if (error instanceof ApiError) return null;
    throw error;
  });
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
        <Suspense fallback={null}>
          <AttentionSummarySection date={deskDate} />
        </Suspense>
        <HotelClock timezone={hotel?.property.timezone ?? 'Asia/Almaty'} />
      </div>
      <PeriodBar period={period} today={today} />
      {period.error && <Alert boxed>{period.error}. Показан сегодняшний день.</Alert>}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardSection period={period} today={today} />
      </Suspense>
      <Suspense fallback={<DeskSkeleton />}>
        <DeskSection date={deskDate} today={today} />
      </Suspense>
    </Page>
  );
}
