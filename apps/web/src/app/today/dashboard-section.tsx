import { cache } from 'react';
import { ApiError, dashboardApi } from '../../lib/api';
import { Alert, Panel } from '../../components/ui';
import { KpiGrid } from './kpi';
import { CategoriesPanel, OccupancyChart, PaymentsPanel, SourcesPanel } from './dashboard-panels';
import type { ResolvedPeriod } from '@pms/domain';

/**
 * Показатели за период — отдельным куском, чтобы экран открывался сразу.
 *
 * Замечание владельца 16.09.2026: «выбираю период и нифига не открывает». Числа за месяц считаются из
 * шахматки и счетов, это самый дорогой вызов на экране, и раньше вся «Главная» ждала его целиком — а при
 * ошибке или обрыве по таймауту не открывалась вовсе, даже заголовок. Теперь ожидание видно (`Suspense`
 * в page.tsx), а отказ называется словами: стойка и остальные блоки остаются на месте.
 */
const loadPeriod = cache((from: string, to: string) => dashboardApi.period(from, to));

export async function DashboardSection({
  period,
  today,
  details = false,
}: {
  period: ResolvedPeriod;
  today: string;
  details?: boolean;
}) {
  const view = await loadPeriod(period.from, period.to).catch((error: unknown) => {
    if (error instanceof ApiError) return error;
    throw error;
  });

  if (view instanceof ApiError && details) return null;
  if (view instanceof ApiError)
    return (
      <Alert tone="warning" boxed data-testid="dashboard-error">
        Показатели за период не загрузились: {view.message} Попробуйте обновить страницу.
      </Alert>
    );

  if (!details) return <KpiGrid current={view.current} previous={view.previous} />;
  return (
    <details className="dashboard-details">
      <summary>
        Подробнее <span>Графики, каналы и платежи</span>
      </summary>
      <KpiGrid current={view.current} previous={view.previous} secondary />
      <div className="dash-grid dash-grid--chart">
        <OccupancyChart period={view.current} today={today} />
        <SourcesPanel period={view.current} />
      </div>
      <div className="dash-grid dash-grid--tables">
        <CategoriesPanel period={view.current} />
        <PaymentsPanel period={view.current} />
      </div>
    </details>
  );
}

/** Пока считаются показатели: ни одного `data-testid` из готового экрана — их читают сверки. */
export function DashboardSkeleton() {
  return (
    <Panel title="Показатели за период">
      <p className="muted" data-testid="dashboard-loading">
        Считаем показатели за период…
      </p>
    </Panel>
  );
}
