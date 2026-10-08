import { Suspense } from 'react';
import Link from 'next/link';
import { resolvePeriod } from '@pms/domain';
import { hotelToday } from '../../lib/hotel-api';
import { displayDate } from '../../lib/display-date';
import { Page } from '../../components/page';
import { Alert } from '../../components/ui';
import { OwnerFinance, OwnerOperations, OwnerLoad } from './owner-dashboard';
import { DashboardRefresh } from './owner-controls';
import './owner-dashboard.css';
import { OwnerPlaceholder, AttentionPlaceholder } from './owner-loading';

/** Главная гостиницы (экран владельца): прежняя страница `/today`, вынесена без изменений поведения (MV8) */
export async function HospitalityToday({ sp }: { sp: Record<string, string | undefined> }) {
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
            <div className="owner-load owner-surface">
              <OwnerPlaceholder variant="load" label="Загружаем загрузку…" />
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
            fallback={<OwnerPlaceholder variant="finance" label="Загружаем финансы…" />}
          >
            <OwnerFinance period={period} />
          </Suspense>
        </section>
        <Suspense
          fallback={
            <>
              <div className="owner-today owner-surface">
                <OwnerPlaceholder variant="today" label="Загружаем события дня…" />
              </div>
              <AttentionPlaceholder />
            </>
          }
        >
          <OwnerOperations date={today} />
        </Suspense>
      </div>
    </Page>
  );
}
