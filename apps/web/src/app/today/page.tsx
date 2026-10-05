import { requireVertical } from '../../lib/vertical-guard';
import { redirect } from 'next/navigation';
import { deskShell } from '../../lib/desk-shell';
import { Suspense } from 'react';
import Link from 'next/link';
import { resolvePeriod } from '@pms/domain';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import { hotelApi, hotelToday } from '../../lib/hotel-api';
import { ApiError } from '../../lib/api';
import { Page } from '../../components/page';
import { Alert } from '../../components/ui';
import { OwnerFinance, OwnerOperations, OwnerOutlook } from './owner-dashboard';
import { DashboardRefresh } from './owner-controls';
import './owner-dashboard.css';

async function CurrencyFinance({ period }: { period: ReturnType<typeof resolvePeriod> }) {
  const hotel = await hotelApi.settings().catch((error: unknown) => {
    if (error instanceof ApiError) return null;
    throw error;
  });
  if (!hotel)
    return (
      <div className="owner-finance">
        <Alert>Не удалось загрузить валюту объекта. Обновите страницу.</Alert>
      </div>
    );
  return <OwnerFinance period={period} currency={hotel.property.currency} />;
}
export default async function TodayPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireVertical(['HOSPITALITY']);
  if ((await deskShell()).vertical === 'BEAUTY') redirect('/calendar');
  const sp = normalizeSearchParams(await searchParams);
  const today = await hotelToday();
  const period = resolvePeriod(
    {
      preset: sp.period ?? (sp.from || sp.to || sp.date ? undefined : 'month'),
      from: sp.from,
      to: sp.to,
      date: sp.date,
    },
    today,
  );
  return (
    <Page title="Главная" width="full" actions={<DashboardRefresh />}>
      <div className="owner-toolbar">
        <nav aria-label="Период финансов">
          {[
            ['today', 'Сегодня'],
            ['week', '7 дней'],
            ['month', 'Месяц'],
          ].map(([id, label]) => (
            <Link
              key={id}
              href={`/today?period=${id}`}
              aria-current={period.preset === id ? 'page' : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <details className="owner-dates">
          <summary>Свои даты</summary>
          <form action="/today" key={`${period.from}|${period.to}`}>
            <input type="hidden" name="period" value="custom" />
            <input
              aria-label="Начало периода"
              type="date"
              name="from"
              defaultValue={period.from}
              required
            />
            <span>–</span>
            <input
              aria-label="Конец периода"
              type="date"
              name="to"
              defaultValue={period.to}
              required
            />
            <button className="btn btn--secondary">Показать</button>
          </form>
        </details>
      </div>
      {period.error && <Alert>{period.error}</Alert>}
      <div className="owner-dashboard" data-testid="owner-dashboard">
        <Suspense
          key={`${period.from}|${period.to}`}
          fallback={
            <div className="owner-finance owner-panel" role="status">
              Загружаем финансы…
            </div>
          }
        >
          <CurrencyFinance period={period} />
        </Suspense>
        <Suspense
          fallback={
            <div className="owner-operations owner-panel" role="status">
              Загружаем данные гостиницы…
            </div>
          }
        >
          <OwnerOperations date={today} />
        </Suspense>
        <Suspense
          fallback={
            <div className="owner-outlook owner-panel" role="status">
              Загружаем прогноз…
            </div>
          }
        >
          <OwnerOutlook today={today} />
        </Suspense>
      </div>
    </Page>
  );
}
