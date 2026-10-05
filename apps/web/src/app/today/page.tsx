import { redirect } from 'next/navigation';
import { deskShell } from '../../lib/desk-shell';
import { Suspense } from 'react';
import Link from 'next/link';
import { resolvePeriod } from '@pms/domain';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import { hotelToday } from '../../lib/hotel-api';
import { displayDate } from '../../lib/display-date';
import { Page } from '../../components/page';
import { Alert } from '../../components/ui';
import { OwnerFinance, OwnerOperations, OwnerLoad } from './owner-dashboard';
import { DashboardRefresh } from './owner-controls';
import './owner-dashboard.css';

export default async function TodayPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
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
    <Page
      title="Главная"
      subtitle={displayDate(today, 'full')}
      width="full"
      actions={<DashboardRefresh />}
    >
      <div className="owner-dashboard" data-testid="owner-dashboard">
        <Suspense
          fallback={
            <div className="owner-load owner-surface" role="status">
              Загружаем загрузку…
            </div>
          }
        >
          <OwnerLoad date={today} />
        </Suspense>
        <section className="owner-finance owner-surface" aria-label="Финансы за выбранный период">
          <header className="owner-section-head">
            <h2>Деньги</h2>
            <nav className="owner-period" aria-label="Период финансов">
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
          </header>
          {period.error && <Alert>{period.error}</Alert>}
          <Suspense
            key={`${period.from}|${period.to}`}
            fallback={
              <p className="owner-caption" role="status">
                Загружаем финансы…
              </p>
            }
          >
            <OwnerFinance period={period} />
          </Suspense>
        </section>
        <Suspense
          fallback={
            <div className="owner-today owner-surface" role="status">
              Загружаем события дня…
            </div>
          }
        >
          <OwnerOperations date={today} />
        </Suspense>
      </div>
    </Page>
  );
}
